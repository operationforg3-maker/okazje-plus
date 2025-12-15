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
        
        // Skip if already has strong SEO enrichment
        const hasEnrichment = data.seo?.metaTitle && 
                              data.seo?.metaDescription && 
                              data.ai?.enrichment?.keywords?.length > 5 &&
                              data.ai?.enrichment?.version >= 2;
        
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

        // AI SEO enrichment prompt
        const prompt = `Jesteś ekspertem SEO dla e-commerce w Polsce. Zoptymalizuj poniższy produkt pod SEO i konwersję.

PRODUKT:
Tytuł: ${titlePL}
Opis: ${descPL}
Cechy: ${features.join(', ')}
Kategoria: ${category}

ZADANIE:
1. SEO Meta Title (50-60 znaków): konkretny, z kluczowym słowem, bez clickbaitu
2. SEO Meta Description (140-160 znaków): przekonująca, z CTA, z korzyścią
3. SEO Keywords (tablica 10-15 słów kluczowych): long-tail, intent-based, naturalne
4. Image Hint (20-40 znaków): alt text dla głównego obrazka, opisowy
5. Benefits (tablica 3-5 korzyści): user-focused, konkretne wartości (nie ogólniki)
6. Tags (tablica 5-8 tagów): kategorie, typy, cechy charakterystyczne

ZASADY:
- Język polski, naturalny, profesjonalny
- Bez CAPS LOCK, bez emoji, bez wykrzykników nadmiaru
- Skoncentruj się na korzyściach i zastosowaniu (nie tylko na parametrach)
- Keywords: mix ogólnych i long-tail (np. "słuchawki bluetooth", "słuchawki do biegania wodoodporne")

Zwróć JSON:
{
  "metaTitle": "...",
  "metaDescription": "...",
  "keywords": ["keyword1", "keyword2", ...],
  "imageHint": "...",
  "benefits": ["korzyść 1", "korzyść 2", ...],
  "tags": ["tag1", "tag2", ...]
}`;

        const response = await generateText(prompt, {
          temperature: 0.4,
          maxTokens: 1200,
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
            metaTitle: enrichment.metaTitle?.slice(0, 60) || titlePL.slice(0, 60),
            metaDescription: enrichment.metaDescription?.slice(0, 160) || descPL.slice(0, 160),
            keywords: enrichment.keywords || [],
            aiVersion: 2,
            enrichedAt: new Date().toISOString(),
          },
          imageHint: enrichment.imageHint || titlePL.slice(0, 40),
          benefits: enrichment.benefits || [],
          tags: enrichment.tags || [],
          'ai.enrichment': {
            enrichedAt: new Date().toISOString(),
            model: 'gemini-2.0-flash',
            version: 2,
            keywords: enrichment.keywords || [],
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
