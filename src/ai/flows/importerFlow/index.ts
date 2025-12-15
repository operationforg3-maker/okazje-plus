/**
 * Modular Product Importer - Orchestra wyciągająca wszystkie 5 etapów
 * 
 * Wzorzec użycia:
 * ```typescript
 * const result = await runProductImportPipeline(
 *   ['phones', 'laptops'],
 *   {
 *     mainCategorySlug: 'electronics',
 *     maxProducts: 500,
 *     translateToPolish: true,
 *     currencyRate: 4.2,
 *   }
 * );
 * ```
 */

import { fetchProductsFromAliexpress, fetchProductsFromConvertiser } from './stageFetch';
import { enhanceProductDetails } from './stageEnhance';
import { deduplicateProducts, sanitizeProducts } from './stageDedupe';
import { enrichProducts } from './stageEnrich';
import { translateProducts } from './stageTranslate';
import { saveProductsToFirestore, SaveConfig } from './stageSave';
import { EnrichedProduct, ImportJobConfig, AliExpressProduct } from './types';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

// Helper to log to Firestore job document
async function logToJob(jobId: string | undefined, message: string, details?: any) {
  if (!jobId) return;
  try {
    await adminDb.collection('import_jobs').doc(jobId).update({
      logs: FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        message,
        details,
      }),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ProductImporter] Failed to log to job:', err);
  }
}

export interface PipelineConfig extends Partial<ImportJobConfig> {
  jobId?: string;
  keywords: string[];
  maxProducts?: number;
  categoryPath: string[];
  categorySlugEN: string;
  subcategorySlugEN: string;
  subsubcategorySlugEN?: string;
  categoryNamePL?: string; // NEW: Polish category name for saving to Firestore
  subcategoryNamePL?: string; // NEW: Polish subcategory name for saving to Firestore
  subsubcategoryNamePL?: string; // NEW: Polish sub-subcategory name for saving to Firestore
  translateToPolish?: boolean;
  currencyRate?: number;
  importerType?: 'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct'; // NEW: wybór metody importu
  aliexpressCategoryIds?: string[]; // NEW: dla hot-products i category-direct
  fetch?: { batchSize?: number; delayBetweenItems?: number; delayBetweenBatches?: number; maxRetries?: number };
  dedupe?: { batchSize?: number; minPrice?: number; maxPrice?: number; minRating?: number; minOrders?: number };
  enrich?: { batchSize?: number; delayBetweenItems?: number; delayBetweenBatches?: number; maxRetries?: number };
  translate?: { batchSize?: number; delayBetweenItems?: number; delayBetweenBatches?: number; maxRetries?: number };
  save?: { batchSize?: number; delayBetweenItems?: number; delayBetweenBatches?: number; skipExisting?: boolean };
}

export async function runProductImportPipeline(
  config: PipelineConfig
): Promise<{
  fetched: AliExpressProduct[];
  deduplicated: AliExpressProduct[];
  enriched: EnrichedProduct[];
  translated: EnrichedProduct[];
  saved: { created: string[]; updated: string[]; skipped: string[] };
  totalTime: number;
}> {
  const startTime = Date.now();
  const jobId = config.jobId;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[ProductImporter] Starting pipeline for ${config.subcategorySlugEN}`);
  console.log(`${'='.repeat(60)}\n`);
  
  await logToJob(jobId, `Starting pipeline for ${config.subcategorySlugEN}`);
  
  try {
    // STAGE 1: FETCH
    const sourceLabel = config.importerType === 'convertiser' ? 'Convertiser' : 'AliExpress';
    console.log(`[ProductImporter] Stage 1: FETCH from ${sourceLabel}`);
    console.log(`[ProductImporter] Importer Type: ${config.importerType || 'keyword-search'}`);
    
    await logToJob(jobId, `Stage 1: Fetching from ${sourceLabel}`, { importerType: config.importerType });
    
    let fetched: AliExpressProduct[] = [];
    
    if (config.importerType === 'convertiser') {
      // Fetch from Convertiser instead of AliExpress
      fetched = await fetchProductsFromConvertiser(
        config.keywords,
        {
          name: 'fetch',
          batchSize: config.fetch?.batchSize || 50,
          delayBetweenItems: config.fetch?.delayBetweenItems || 100,
          delayBetweenBatches: config.fetch?.delayBetweenBatches || 500,
          maxRetries: config.fetch?.maxRetries || 1,
          importerType: 'convertiser',
        }
      );
    } else {
      // Fetch from AliExpress (default, hot-products, category-direct)
      fetched = await fetchProductsFromAliexpress(
        config.keywords,
        {
          name: 'fetch',
          batchSize: config.fetch?.batchSize || 50,
          delayBetweenItems: config.fetch?.delayBetweenItems || 200,
          delayBetweenBatches: config.fetch?.delayBetweenBatches || 1000,
          maxRetries: config.fetch?.maxRetries || 2,
          importerType: config.importerType || 'keyword-search', // NEW: pass importer type
        }
      );
    }
    
    console.log(`[ProductImporter] ✅ Fetched: ${fetched.length} products`);
    await logToJob(jobId, `Stage 1: Fetched ${fetched.length} products`, { source: sourceLabel });
    
    if (fetched.length === 0) {
      console.error(`[ProductImporter] ❌ PROBLEM: No products fetched!`);
      console.error(`[ProductImporter] Possible reasons:`);
      console.error(`  1. ${sourceLabel} API not configured - check .env.local`);
      console.error(`  2. Keywords don't match products: ${config.keywords.join(', ')}`);
      console.error(`  3. API rate limiting or network issue`);
      console.error(`[ProductImporter] Aborting pipeline for ${config.categorySlugEN}/${config.subcategorySlugEN}`);
      await logToJob(jobId, `Aborting: No products fetched from ${sourceLabel}`);
      return {
        fetched: [],
        deduplicated: [],
        enriched: [],
        translated: [],
        saved: { created: [], updated: [], skipped: [] },
        totalTime: Date.now() - startTime,
      };
    }
    
    // STAGE 1.5: ENHANCE (Pobierz szczegółowe dane produktów)
    console.log(`[ProductImporter] Stage 1.5: ENHANCE - Fetching detailed product info`);
    await logToJob(jobId, `Stage 1.5: Enhancing with detailed data...`);
    
    const enhanced = await enhanceProductDetails(fetched, {
      name: 'enhance',
      batchSize: 10,
      delayBetweenItems: 300,
      delayBetweenBatches: 1000,
      maxRetries: 2,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002',
      skipIfHasDescription: false, // Always fetch details
    });
    
    console.log(`[ProductImporter] ✅ Enhanced: ${enhanced.length} products with detailed data`);
    await logToJob(jobId, `Stage 1.5: Enhanced ${enhanced.length} products`);
    
    // STAGE 2: DEDUPE
    console.log(`[ProductImporter] Stage 2: DEDUPLICATE & SANITIZE`);
    await logToJob(jobId, `Stage 2: Deduplicating...`);
    
    // Sanitize with relaxed rules
    let deduplicated = sanitizeProducts(enhanced);
    deduplicated = await deduplicateProducts(
      deduplicated,
      {
        name: 'dedupe',
        batchSize: config.dedupe?.batchSize ?? 50,
        delayBetweenItems: 0,
        delayBetweenBatches: 0,
        maxRetries: 0,
        minPrice: config.dedupe?.minPrice ?? 5,
        maxPrice: config.dedupe?.maxPrice ?? 10000,
        minRating: config.dedupe?.minRating ?? 2.5,
        minOrders: config.dedupe?.minOrders ?? 10,
      }
    );
    
    console.log(`[ProductImporter] Deduplicated: ${deduplicated.length} products\n`);
    await logToJob(jobId, `Stage 2: Deduplicated to ${deduplicated.length} products`);
    
    if (deduplicated.length === 0) {
      console.warn(`[ProductImporter] No products after deduplication, aborting`);
      return {
        fetched,
        deduplicated: [],
        enriched: [],
        translated: [],
        saved: { created: [], updated: [], skipped: [] },
        totalTime: Date.now() - startTime,
      };
    }
    
    // Limit to maxProducts if specified
    let forEnrichment = deduplicated;
    if (config.maxProducts && forEnrichment.length > config.maxProducts) {
      forEnrichment = forEnrichment.slice(0, config.maxProducts);
      console.log(`[ProductImporter] Limited to ${config.maxProducts} products\n`);
    }
    
    // STAGE 3: ENRICH
    console.log(`[ProductImporter] Stage 3: ENRICH & NORMALIZE`);
    const enriched = await enrichProducts(
      forEnrichment,
      config.categorySlugEN,
      config.subcategorySlugEN,
      config.subsubcategorySlugEN || config.subcategorySlugEN,
      {
        name: 'enrich',
        batchSize: config.enrich?.batchSize ?? 10,
        delayBetweenItems: config.enrich?.delayBetweenItems ?? 200,
        delayBetweenBatches: config.enrich?.delayBetweenBatches ?? 1000,
        maxRetries: config.enrich?.maxRetries ?? 1,
        currencyTarget: 'PLN',
        exchangeRateUsdToPln: config.currencyRate ?? 4.0,
      }
    );
    
    console.log(`[ProductImporter] Enriched: ${enriched.length} products\n`);
    await logToJob(jobId, `Stage 3: Enriched ${enriched.length} products`);
    
    // STAGE 4: TRANSLATE (optional)
    let translated = enriched;
    if (config.translateToPolish !== false) {
      console.log(`[ProductImporter] Stage 4: TRANSLATE to Polish`);
      await logToJob(jobId, `Stage 4: Translating to Polish...`);
      translated = await translateProducts(
        enriched,
        {
          name: 'translate',
          batchSize: config.translate?.batchSize ?? 20,
          delayBetweenItems: config.translate?.delayBetweenItems ?? 30,
          delayBetweenBatches: config.translate?.delayBetweenBatches ?? 200,
          maxRetries: config.translate?.maxRetries ?? 0,
        }
      );
      
      console.log(`[ProductImporter] Translated: ${translated.length} products\n`);
      await logToJob(jobId, `Stage 4: Translated ${translated.length} products`);
    }
    
    // STAGE 5: SAVE
    console.log(`[ProductImporter] Stage 5: SAVE to Firestore`);
    await logToJob(jobId, `Stage 5: Saving to Firestore...`);
    const saved = await saveProductsToFirestore(
      translated,
      {
        name: 'save',
        batchSize: config.save?.batchSize || 5,
        delayBetweenItems: config.save?.delayBetweenItems || 100,
        delayBetweenBatches: config.save?.delayBetweenBatches || 500,
        maxRetries: 0,
        skipExisting: config.save?.skipExisting ?? false,
        jobId,
        categoryNamePL: config.categoryNamePL,
        subcategoryNamePL: config.subcategoryNamePL,
        subsubcategoryNamePL: config.subsubcategoryNamePL,
      }
    );
    
    console.log(`[ProductImporter] Saved: ${saved.created.length} created, ${saved.updated.length} updated, ${saved.skipped.length} skipped\n`);
    
    const totalTime = Date.now() - startTime;
    console.log(`${'='.repeat(60)}`);
    console.log(`[ProductImporter] Pipeline completed in ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`[ProductImporter] ✅ SUMMARY:`);
    console.log(`  📦 Fetched: ${fetched.length} products`);
    console.log(`  🔍 Deduplicated: ${deduplicated.length} products`);
    console.log(`  ✨ Enriched: ${enriched.length} products`);
    console.log(`  🌐 Translated: ${translated.length} products`);
    console.log(`  💾 Saved: ${saved.created.length} created, ${saved.updated.length} updated, ${saved.skipped.length} skipped`);
    console.log(`${'='.repeat(60)}\n`);
    
    return {
      fetched,
      deduplicated,
      enriched,
      translated,
      saved,
      totalTime,
    };
    
  } catch (error: any) {
    console.error(`[ProductImporter] Pipeline failed:`, error);
    throw error;
  }
}

export { fetchProductsFromAliexpress, fetchProductsFromConvertiser } from './stageFetch';
export { deduplicateProducts, sanitizeProducts } from './stageDedupe';
export { enrichProducts } from './stageEnrich';
export { translateProducts } from './stageTranslate';
export { saveProductsToFirestore } from './stageSave';
export type { EnrichedProduct, ImportJobConfig, ImportStageConfig } from './types';
