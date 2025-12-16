import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateText } from '@/lib/vertex';

/**
 * POST /api/admin/deals/ai-translate
 * AI-powered translation for deals - creates a background job
 * Translates: title, description
 * Uses Gemini for high-quality PL translations with SEO optimization
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit ?? 50), 1), 500);
    const { mainCategorySlug, subCategorySlug, subSubCategorySlug, status, force, dealId } = body || {};

    // Create job in Firestore
    const jobRef = adminDb.collection('import_jobs').doc();
    const jobId = jobRef.id;
    const now = new Date().toISOString();

    const jobData = {
      id: jobId,
      type: 'ai-translate-deals',
      status: 'queued',
      progress: {
        total: limit,
        completed: 0,
        failed: 0,
        current: 0,
      },
      filters: {
        limit,
        status: status || null,
        force: force || false,
        dealId: dealId || null,
        mainCategorySlug: mainCategorySlug || null,
        subCategorySlug: subCategorySlug || null,
        subSubCategorySlug: subSubCategorySlug || null,
      },
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      logs: [],
    };

    await jobRef.set(jobData);
    console.log(`[AI Translate Deals] Job created: ${jobId}`);

    // Start processor in background
    setImmediate(() => {
      processAIDealTranslateJob(jobId).catch((e) => {
        console.error(`[AI Translate Deals] Processor failed for job ${jobId}:`, e);
        jobRef.update({
          status: 'failed',
          error: e.message,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).catch(console.error);
      });
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: `Job AI tłumaczenia deali uruchomiony (max ${limit} deali)`,
    }, { status: 202 });
  } catch (e: any) {
    console.error('[AI Translate Deals] Error:', e);
    return NextResponse.json({ error: e.message || 'AI translation failed' }, { status: 500 });
  }
}

/**
 * Background processor for AI deal translation jobs
 */
export async function processAIDealTranslateJob(jobId: string) {
  const jobRef = adminDb.collection('import_jobs').doc(jobId);
  
  try {
    console.log(`[AI Translate Deals Processor] Starting job ${jobId}`);
    
    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const jobSnap = await jobRef.get();
    const jobData = jobSnap.data();
    if (!jobData) throw new Error('Job not found');

    const { limit, status, force, dealId, mainCategorySlug, subCategorySlug, subSubCategorySlug } = jobData.filters || {};

    let snap: FirebaseFirestore.QuerySnapshot;
    
    // If specific dealId provided, fetch only that deal
    if (dealId) {
      const doc = await adminDb.collection('deals').doc(String(dealId)).get();
      if (!doc.exists) {
        throw new Error(`Deal ${dealId} not found`);
      }
      snap = { docs: [doc], empty: false } as any;
    } else {
      // Otherwise use filters
      let q: FirebaseFirestore.Query = adminDb.collection('deals');
      if (status) q = q.where('status', '==', String(status));
      if (mainCategorySlug) q = q.where('mainCategorySlug', '==', String(mainCategorySlug));
      if (subCategorySlug) q = q.where('subCategorySlug', '==', String(subCategorySlug));
      if (subSubCategorySlug) q = q.where('subSubCategorySlug', '==', String(subSubCategorySlug));
      snap = await q.limit(limit || 50).get();
    }
    
    if (snap.empty) {
      await jobRef.update({
        status: 'completed',
        'progress.total': 0,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    await jobRef.update({ 'progress.total': snap.docs.length });

    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < snap.docs.length; i++) {
      const doc = snap.docs[i];

      // Update progress
      await jobRef.update({
        'progress.current': i,
        updatedAt: new Date().toISOString(),
      });

      try {
        const data = doc.data() || {};
        
        // Skip if already has good translations in all 3 languages
        const hasPL = data.title?.pl && data.description?.pl && data.description?.pl.length > 50;
        const hasEN = data.title?.en && data.description?.en && data.description?.en.length > 50;
        const hasDE = data.title?.de && data.description?.de && data.description?.de.length > 50;
        if (hasPL && hasEN && hasDE && !force) {
          skippedCount++;
          continue;
        }

        const sourceTitle = data.title?.en || data.title || '';
        const sourceDesc = data.description?.en || data.description || '';

        if (!sourceTitle || !sourceDesc) {
          skippedCount++;
          continue;
        }

        // AI Translation prompt for PL, EN, DE
        const prompt = `You are an expert e-commerce translator. Translate the following deal/offer to POLISH (PL), ENGLISH (EN), and GERMAN (DE) with SEO optimization.

SOURCE TITLE: ${sourceTitle}

SOURCE DESCRIPTION: ${sourceDesc}

REQUIREMENTS:
1. Title (50-70 chars): professional, with keywords, no CAPS LOCK, no emoji
2. Description (150-300 chars): compelling, user benefits, natural language (no clickbait)

Return JSON:
{
  "titlePL": "...",
  "descriptionPL": "...",
  "titleEN": "...",
  "descriptionEN": "...",
  "titleDE": "...",
  "descriptionDE": "..."
}`;

        const response = await generateText(prompt, {
          temperature: 0.3,
          maxTokens: 1500,
        });

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn(`[AI Translate Deals] No JSON in response for deal ${doc.id}`);
          skippedCount++;
          continue;
        }

        const translation = JSON.parse(jsonMatch[0]);

        const updates: any = {
          title: {
            pl: translation.titlePL || sourceTitle,
            en: translation.titleEN || sourceTitle,
            de: translation.titleDE || sourceTitle,
          },
          description: {
            pl: translation.descriptionPL || sourceDesc,
            en: translation.descriptionEN || sourceDesc,
            de: translation.descriptionDE || sourceDesc,
          },
          'ai.translation': {
            translatedAt: new Date().toISOString(),
            model: 'gemini-2.0-flash',
            version: 3,
            languages: ['pl', 'en', 'de'],
          },
          updatedAt: new Date().toISOString(),
        };

        await doc.ref.set(updates, { merge: true });
        updatedCount++;

        // Rate limit: 200ms between deals
        await new Promise(r => setTimeout(r, 200));
      } catch (e: any) {
        console.error(`[AI Translate Deals Processor] Error for deal ${doc.id}:`, e.message);
        skippedCount++;
        await jobRef.update({ 'progress.failed': skippedCount });
      }
    }

    await jobRef.update({
      status: 'completed',
      'progress.completed': updatedCount,
      'progress.failed': skippedCount,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [{
        timestamp: new Date().toISOString(),
        message: `Przetłumaczono ${updatedCount} deali, pominięto ${skippedCount}`,
        status: 'success',
      }],
    });

    console.log(`[AI Translate Deals Processor] Job ${jobId} completed: ${updatedCount} updated, ${skippedCount} skipped`);
  } catch (e: any) {
    console.error('[AI Translate Deals Processor] Error:', e);
    await jobRef.update({
      status: 'failed',
      error: e.message,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    throw e;
  }
}
