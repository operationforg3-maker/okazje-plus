/**
 * Admin debug endpoint to run import pipeline stage-by-stage.
 * POST /api/admin/import/debug
 * 
 * Body example:
 * {
 *   "keywords": ["smartphone"],
 *   "categorySlugEN": "electronics",
 *   "subcategorySlugEN": "phones",
 *   "subsubcategorySlugEN": "smartphones",
 *   "importerType": "keyword-search", // or "hot-products" | "convertiser"
 *   "stage": "translate", // fetch | dedupe | enrich | translate | save | all
 *   "maxProducts": 20,
 *   "translateToPolish": true,
 *   "writeToDb": false, // set true to persist in Firestore
 *   "sampleSize": 5
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { fetchProductsFromAliexpress, fetchProductsFromConvertiser, deduplicateProducts, sanitizeProducts, enrichProducts, translateProducts, saveProductsToFirestore } from '@/ai/flows/importerFlow';

type Stage = 'fetch' | 'dedupe' | 'enrich' | 'translate' | 'save' | 'all';

export async function POST(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      keywords,
      categorySlugEN,
      subcategorySlugEN,
      subsubcategorySlugEN,
      importerType = 'keyword-search',
      stage = 'all',
      maxProducts = 20,
      translateToPolish = true,
      writeToDb = false,
      sampleSize = 5,
      currencyRate = 4.0,
    } = body || {};

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'keywords array is required' }, { status: 400 });
    }

    if (!categorySlugEN || !subcategorySlugEN) {
      return NextResponse.json({ error: 'categorySlugEN and subcategorySlugEN are required' }, { status: 400 });
    }

    const limitSample = <T>(items: T[], n: number) => items.slice(0, Math.max(0, n));

    // Stage 1: Fetch
    let fetched: any[] = [];
    if (stage === 'fetch' || stage === 'dedupe' || stage === 'enrich' || stage === 'translate' || stage === 'save' || stage === 'all') {
      fetched = importerType === 'convertiser'
        ? await fetchProductsFromConvertiser(keywords, {
            name: 'fetch',
            batchSize: 30,
            delayBetweenItems: 100,
            delayBetweenBatches: 300,
            maxRetries: 1,
            importerType: 'convertiser',
          })
        : await fetchProductsFromAliexpress(keywords, {
            name: 'fetch',
            batchSize: 30,
            delayBetweenItems: 100,
            delayBetweenBatches: 300,
            maxRetries: 1,
            importerType,
          });
    }

    // Early return for fetch-only
    if (stage === 'fetch') {
      return NextResponse.json({
        success: true,
        stage: 'fetch',
        counts: { fetched: fetched.length },
        sample: { fetched: limitSample(fetched, sampleSize) },
      });
    }

    // Stage 2: Dedupe & sanitize
    const sanitized = sanitizeProducts(fetched);
    const deduped = await deduplicateProducts(sanitized, {
      name: 'dedupe',
      batchSize: 50,
      delayBetweenItems: 0,
      delayBetweenBatches: 0,
      maxRetries: 0,
      minPrice: 5,
      maxPrice: 10000,
      minRating: 2.5,
      minOrders: 10,
    });

    if (stage === 'dedupe') {
      return NextResponse.json({
        success: true,
        stage: 'dedupe',
        counts: { fetched: fetched.length, deduplicated: deduped.length },
        sample: {
          fetched: limitSample(fetched, sampleSize),
          deduplicated: limitSample(deduped, sampleSize),
        },
      });
    }

    // Stage 3: Enrich
    const toEnrich = deduped.slice(0, maxProducts || deduped.length);
    const enriched = await enrichProducts(
      toEnrich,
      categorySlugEN,
      subcategorySlugEN,
      subsubcategorySlugEN || subcategorySlugEN,
      {
        name: 'enrich',
        batchSize: 5,
        delayBetweenItems: 200,
        delayBetweenBatches: 800,
        maxRetries: 1,
        currencyTarget: 'PLN',
        exchangeRateUsdToPln: currencyRate,
      }
    );

    if (stage === 'enrich') {
      return NextResponse.json({
        success: true,
        stage: 'enrich',
        counts: {
          fetched: fetched.length,
          deduplicated: deduped.length,
          enriched: enriched.length,
        },
        sample: {
          enriched: limitSample(enriched, sampleSize),
        },
      });
    }

    // Stage 4: Translate (optional)
    let translated = enriched;
    if (translateToPolish !== false) {
      translated = await translateProducts(enriched, {
        name: 'translate',
        batchSize: 10,
        delayBetweenItems: 50,
        delayBetweenBatches: 300,
        maxRetries: 0,
      });
    }

    if (stage === 'translate') {
      return NextResponse.json({
        success: true,
        stage: 'translate',
        counts: {
          fetched: fetched.length,
          deduplicated: deduped.length,
          enriched: enriched.length,
          translated: translated.length,
        },
        sample: {
          translated: limitSample(translated, sampleSize),
        },
      });
    }

    // Stage 5: Save (optional write)
    let saved: { created: string[]; updated: string[]; skipped: string[] } = { created: [], updated: [], skipped: [] };
    if (writeToDb) {
      saved = await saveProductsToFirestore(translated, {
        name: 'save',
        batchSize: 5,
        delayBetweenItems: 100,
        delayBetweenBatches: 400,
        maxRetries: 0,
        skipExisting: true,
        jobId: body.jobId,
      });
    }

    return NextResponse.json({
      success: true,
      stage: stage === 'all' ? 'all' : 'save',
      counts: {
        fetched: fetched.length,
        deduplicated: deduped.length,
        enriched: enriched.length,
        translated: translated.length,
        savedCreated: saved.created.length,
        savedUpdated: saved.updated.length,
        savedSkipped: saved.skipped.length,
      },
      writeToDb,
      sample: {
        fetched: limitSample(fetched, sampleSize),
        deduplicated: limitSample(deduped, sampleSize),
        enriched: limitSample(enriched, sampleSize),
        translated: limitSample(translated, sampleSize),
        saved: limitSample(saved.created, sampleSize),
      },
    });
  } catch (error: any) {
    console.error('[Import Debug] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
