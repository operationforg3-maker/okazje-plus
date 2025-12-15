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
        
        // Skip if already has good PL translations
        const hasPL = data.title?.pl && data.fullDescription?.pl && data.fullDescription?.pl.length > 100;
        if (hasPL && !body.force) {
          skippedCount++;
          continue;
        }

        const enTitle = data.title?.en || data.name || '';
        const enDesc = data.fullDescription?.en || data.description || '';
        const enShortDesc = data.shortDescription?.en || enDesc.slice(0, 200);
        const features = data.features || [];

        if (!enTitle || !enDesc) {
          skippedCount++;
          continue;
        }

        // AI Translation prompt
        const prompt = `Jesteś ekspertem tłumaczeń e-commerce PL. Przetłumacz poniższy produkt z EN na PL z optymalizacją SEO.

TYTUŁ EN: ${enTitle}

OPIS KRÓTKI EN: ${enShortDesc}

OPIS PEŁNY EN: ${enDesc}

CECHY EN: ${features.join(', ')}

WYMAGANIA:
1. Tytuł PL: profesjonalny, 50-70 znaków, z kluczowymi słowami (bez CAPS LOCK, bez emoji)
2. Opis krótki PL: 2-3 zdania, korzyści dla użytkownika (120-180 znaków)
3. Opis pełny PL: szczegółowy, 300-600 znaków, wzmianki o parametrach i zastosowaniu, naturalny język (nie clickbait)
4. Cechy PL: tablica 5-8 cech w formie krótkich fraz (np. "Szybkie ładowanie 30W", "Wodoodporność IP68")

Zwróć JSON:
{
  "titlePL": "...",
  "shortDescriptionPL": "...",
  "fullDescriptionPL": "...",
  "featuresPL": ["cecha1", "cecha2", ...]
}`;

        const response = await generateText(prompt, {
          temperature: 0.3,
          maxTokens: 1500,
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
            en: enTitle,
            pl: translation.titlePL || enTitle,
          },
          shortDescription: {
            en: enShortDesc,
            pl: translation.shortDescriptionPL || enShortDesc,
          },
          fullDescription: {
            en: enDesc,
            pl: translation.fullDescriptionPL || enDesc,
          },
          features: translation.featuresPL || features,
          'ai.translation': {
            translatedAt: new Date().toISOString(),
            model: 'gemini-2.0-flash',
            version: 2,
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
