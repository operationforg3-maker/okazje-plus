import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateText } from '@/lib/vertex';

/**
 * POST /api/admin/products/ai-translate
 * AI-powered translation for products - creates a background job
 * Translates: title, shortDescription, fullDescription, features
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
    const { mainCategorySlug, subCategorySlug, subSubCategorySlug, status, force, productId } = body || {};

    // Create job in Firestore
    const jobRef = adminDb.collection('import_jobs').doc();
    const jobId = jobRef.id;
    const now = new Date().toISOString();

    const jobData = {
      id: jobId,
      type: 'ai-translate',
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
        productId: productId || null,
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
    console.log(`[AI Translate] Job created: ${jobId}`);

    // Start processor in background
    setImmediate(() => {
      processAITranslateJob(jobId).catch((e) => {
        console.error(`[AI Translate] Processor failed for job ${jobId}:`, e);
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
      message: `Job AI tłumaczenia uruchomiony (max ${limit} produktów)`,
    }, { status: 202 });
  } catch (e: any) {
    console.error('[AI Translate] Error:', e);
    return NextResponse.json({ error: e.message || 'AI translation failed' }, { status: 500 });
  }
}

/**
 * Background processor for AI translation jobs
 */
export async function processAITranslateJob(jobId: string) {
  const jobRef = adminDb.collection('import_jobs').doc(jobId);
  
  try {
    console.log(`[AI Translate Processor] Starting job ${jobId}`);
    
    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const jobSnap = await jobRef.get();
    const jobData = jobSnap.data();
    if (!jobData) throw new Error('Job not found');

    const { limit, status, force, productId, mainCategorySlug, subCategorySlug, subSubCategorySlug } = jobData.filters || {};

    let snap: FirebaseFirestore.QuerySnapshot;
    
    // If specific productId provided, fetch only that product
    if (productId) {
      const doc = await adminDb.collection('products').doc(String(productId)).get();
      if (!doc.exists) {
        throw new Error(`Product ${productId} not found`);
      }
      snap = { docs: [doc], empty: false } as any;
    } else {
      // Otherwise use filters
      let q: FirebaseFirestore.Query = adminDb.collection('products');
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
        const hasPL = data.title?.pl && data.fullDescription?.pl && data.fullDescription?.pl.length > 100;
        const hasEN = data.title?.en && data.fullDescription?.en && data.fullDescription?.en.length > 100;
        const hasDE = data.title?.de && data.fullDescription?.de && data.fullDescription?.de.length > 100;
        if (hasPL && hasEN && hasDE && !force) {
          skippedCount++;
          continue;
        }

        const sourceTitle = data.title?.en || data.name || '';
        const sourceDesc = data.fullDescription?.en || data.description || '';
        const sourceShortDesc = data.shortDescription?.en || sourceDesc.slice(0, 200);
        const features = data.features || [];

        if (!sourceTitle || !sourceDesc) {
          skippedCount++;
          continue;
        }

        // AI Translation prompt for PL, EN, DE
        const prompt = `You are an expert e-commerce translator. Translate the following product to POLISH (PL), ENGLISH (EN), and GERMAN (DE) with SEO optimization.

SOURCE TITLE: ${sourceTitle}

SOURCE SHORT DESCRIPTION: ${sourceShortDesc}

SOURCE FULL DESCRIPTION: ${sourceDesc}

SOURCE FEATURES: ${features.join(', ')}

REQUIREMENTS:
1. Title (50-70 chars): professional, with keywords, no CAPS LOCK, no emoji
2. Short description (120-180 chars): 2-3 sentences, user benefits
3. Full description (300-600 chars): detailed, parameters and use cases, natural language (no clickbait)
4. Features (5-8 items): short phrases like "Fast charging 30W", "Waterproof IP68"

Return JSON:
{
  "titlePL": "...",
  "shortDescriptionPL": "...",
  "fullDescriptionPL": "...",
  "featuresPL": ["cecha1", "cecha2", ...],
  "titleEN": "...",
  "shortDescriptionEN": "...",
  "fullDescriptionEN": "...",
  "featuresEN": ["feature1", "feature2", ...],
  "titleDE": "...",
  "shortDescriptionDE": "...",
  "fullDescriptionDE": "...",
  "featuresDE": ["merkmal1", "merkmal2", ...]
}`;

        const response = await generateText(prompt, {
          temperature: 0.3,
          maxTokens: 2500,
        });

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn(`[AI Translate] No JSON in response for product ${doc.id}`);
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
          shortDescription: {
            pl: translation.shortDescriptionPL || sourceShortDesc,
            en: translation.shortDescriptionEN || sourceShortDesc,
            de: translation.shortDescriptionDE || sourceShortDesc,
          },
          fullDescription: {
            pl: translation.fullDescriptionPL || sourceDesc,
            en: translation.fullDescriptionEN || sourceDesc,
            de: translation.fullDescriptionDE || sourceDesc,
          },
          features: translation.featuresPL || features,
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

        // Rate limit: 200ms between products
        await new Promise(r => setTimeout(r, 200));
      } catch (e: any) {
        console.error(`[AI Translate Processor] Error for product ${doc.id}:`, e.message);
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
        message: `Przetłumaczono ${updatedCount} produktów, pominięto ${skippedCount}`,
        status: 'success',
      }],
    });

    console.log(`[AI Translate Processor] Job ${jobId} completed: ${updatedCount} updated, ${skippedCount} skipped`);
  } catch (e: any) {
    console.error('[AI Translate Processor] Error:', e);
    await jobRef.update({
      status: 'failed',
      error: e.message,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    throw e;
  }
}
