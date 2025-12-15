import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';
import { generateText } from '@/lib/vertex';

/**
 * POST /api/admin/products/ai-translate
 * AI-powered translation for ALL products (not just drafts)
 * Translates: title, shortDescription, fullDescription, features
 * Uses Gemini for high-quality PL translations with SEO optimization
 */
export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit ?? 50), 1), 500);
    const { mainCategorySlug, subCategorySlug, subSubCategorySlug, status } = body || {};

    let q: FirebaseFirestore.Query = adminDb.collection('products');
    
    // Optional status filter (if not provided, process ALL statuses)
    if (status) q = q.where('status', '==', String(status));
    
    if (mainCategorySlug) q = q.where('mainCategorySlug', '==', String(mainCategorySlug));
    if (subCategorySlug) q = q.where('subCategorySlug', '==', String(subCategorySlug));
    if (subSubCategorySlug) q = q.where('subSubCategorySlug', '==', String(subSubCategorySlug));

    const snap = await q.limit(limit).get();
    if (snap.empty) return NextResponse.json({ success: true, updated: 0, skipped: 0 });

    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of snap.docs) {
      try {
        const data = doc.data() || {};
        
        // Skip if already has good translations in all 3 languages
        const hasPL = data.title?.pl && data.fullDescription?.pl && data.fullDescription?.pl.length > 100;
        const hasEN = data.title?.en && data.fullDescription?.en && data.fullDescription?.en.length > 100;
        const hasDE = data.title?.de && data.fullDescription?.de && data.fullDescription?.de.length > 100;
        if (hasPL && hasEN && hasDE && !body.force) {
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
        console.error(`[AI Translate] Error for product ${doc.id}:`, e.message);
        skippedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      updated: updatedCount, 
      skipped: skippedCount,
      message: `Przetłumaczono ${updatedCount} produktów, pominięto ${skippedCount}`,
    });
  } catch (e: any) {
    console.error('[AI Translate] Error:', e);
    return NextResponse.json({ error: e.message || 'AI translation failed' }, { status: 500 });
  }
}
