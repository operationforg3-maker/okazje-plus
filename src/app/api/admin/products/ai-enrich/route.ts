import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';
import { generateText } from '@/lib/vertex';

/**
 * POST /api/admin/products/ai-enrich
 * AI-powered SEO enrichment for ALL products (not just drafts)
 * Generates: SEO meta tags, keywords, imageHint, benefits, tags
 * Uses Gemini for comprehensive content optimization
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
        
        // Skip if already has strong SEO enrichment in all 3 languages
        const hasEnrichment = data.seo?.pl?.metaTitle && 
                              data.seo?.en?.metaTitle && 
                              data.seo?.de?.metaTitle && 
                              data.ai?.enrichment?.version >= 3;
        
        if (hasEnrichment && !body.force) {
          skippedCount++;
          continue;
        }

        const titlePL = data.title?.pl || data.title?.en || data.name || '';
        const descPL = data.fullDescription?.pl || data.fullDescription?.en || data.description || '';
        const features = data.features || [];
        const category = [
          data.mainCategorySlug, 
          data.subCategorySlug, 
          data.subSubCategorySlug
        ].filter(Boolean).join(' / ');

        if (!titlePL || !descPL) {
          skippedCount++;
          continue;
        }

        // AI SEO enrichment prompt for PL, EN, DE
        const prompt = `You are an SEO expert for e-commerce. Optimize the following product for SEO and conversion in POLISH (PL), ENGLISH (EN), and GERMAN (DE).

PRODUCT:
Title: ${titlePL}
Description: ${descPL}
Features: ${features.join(', ')}
Category: ${category}

TASK - Generate for EACH language (PL, EN, DE):
1. SEO Meta Title (50-60 chars): specific, with main keyword, no clickbait
2. SEO Meta Description (140-160 chars): compelling, with CTA, value proposition
3. SEO Keywords (10-15 keywords): long-tail, intent-based, natural
4. Image Hint (20-40 chars): descriptive alt text for main image
5. Benefits (3-5 items): user-focused, concrete values (not generic)
6. Tags (5-8 tags): categories, types, characteristics

RULES:
- Natural, professional language for each locale
- No CAPS LOCK, no emoji, no excessive exclamation marks
- Focus on benefits and use cases (not just specs)
- Keywords: mix general and long-tail (e.g., "bluetooth headphones", "waterproof running headphones")

Return JSON:
{
  "pl": {
    "metaTitle": "...",
    "metaDescription": "...",
    "keywords": ["keyword1", "keyword2", ...],
    "imageHint": "...",
    "benefits": ["korzyść 1", "korzyść 2", ...],
    "tags": ["tag1", "tag2", ...]
  },
  "en": {
    "metaTitle": "...",
    "metaDescription": "...",
    "keywords": ["keyword1", "keyword2", ...],
    "imageHint": "...",
    "benefits": ["benefit 1", "benefit 2", ...],
    "tags": ["tag1", "tag2", ...]
  },
  "de": {
    "metaTitle": "...",
    "metaDescription": "...",
    "keywords": ["keyword1", "keyword2", ...],
    "imageHint": "...",
    "benefits": ["vorteil 1", "vorteil 2", ...],
    "tags": ["tag1", "tag2", ...]
  }
}`;

        const response = await generateText(prompt, {
          temperature: 0.4,
          maxTokens: 2500,
        });

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn(`[AI Enrich] No JSON in response for product ${doc.id}`);
          skippedCount++;
          continue;
        }

        const enrichment = JSON.parse(jsonMatch[0]);

        const updates: any = {
          seo: {
            pl: {
              metaTitle: enrichment.pl?.metaTitle?.slice(0, 60) || titlePL.slice(0, 60),
              metaDescription: enrichment.pl?.metaDescription?.slice(0, 160) || descPL.slice(0, 160),
              keywords: enrichment.pl?.keywords || [],
            },
            en: {
              metaTitle: enrichment.en?.metaTitle?.slice(0, 60) || titlePL.slice(0, 60),
              metaDescription: enrichment.en?.metaDescription?.slice(0, 160) || descPL.slice(0, 160),
              keywords: enrichment.en?.keywords || [],
            },
            de: {
              metaTitle: enrichment.de?.metaTitle?.slice(0, 60) || titlePL.slice(0, 60),
              metaDescription: enrichment.de?.metaDescription?.slice(0, 160) || descPL.slice(0, 160),
              keywords: enrichment.de?.keywords || [],
            },
            aiVersion: 3,
            enrichedAt: new Date().toISOString(),
          },
          imageHint: {
            pl: enrichment.pl?.imageHint || titlePL.slice(0, 40),
            en: enrichment.en?.imageHint || titlePL.slice(0, 40),
            de: enrichment.de?.imageHint || titlePL.slice(0, 40),
          },
          benefits: {
            pl: enrichment.pl?.benefits || [],
            en: enrichment.en?.benefits || [],
            de: enrichment.de?.benefits || [],
          },
          tags: {
            pl: enrichment.pl?.tags || [],
            en: enrichment.en?.tags || [],
            de: enrichment.de?.tags || [],
          },
          'ai.enrichment': {
            enrichedAt: new Date().toISOString(),
            model: 'gemini-2.0-flash',
            version: 3,
            languages: ['pl', 'en', 'de'],
          },
          updatedAt: new Date().toISOString(),
        };

        await doc.ref.set(updates, { merge: true });
        updatedCount++;

        // Rate limit: 300ms between products (more complex prompt)
        await new Promise(r => setTimeout(r, 300));
      } catch (e: any) {
        console.error(`[AI Enrich] Error for product ${doc.id}:`, e.message);
        skippedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      updated: updatedCount, 
      skipped: skippedCount,
      message: `Ubogacono ${updatedCount} produktów, pominięto ${skippedCount}`,
    });
  } catch (e: any) {
    console.error('[AI Enrich] Error:', e);
    return NextResponse.json({ error: e.message || 'AI enrichment failed' }, { status: 500 });
  }
}
