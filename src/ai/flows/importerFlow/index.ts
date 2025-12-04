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

import { fetchProductsFromAliexpress } from './stageFetch';
import { deduplicateProducts, sanitizeProducts } from './stageDedupe';
import { enrichProducts } from './stageEnrich';
import { translateProducts } from './stageTranslate';
import { saveProductsToFirestore, SaveConfig } from './stageSave';
import { EnrichedProduct, ImportJobConfig, AliExpressProduct } from './types';

export interface PipelineConfig extends Partial<ImportJobConfig> {
  jobId?: string;
  keywords: string[];
  maxProducts?: number;
  categoryPath: string[];
  categorySlugEN: string;
  subcategorySlugEN: string;
  subsubcategorySlugEN?: string;
  translateToPolish?: boolean;
  currencyRate?: number;
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
  
  try {
    // STAGE 1: FETCH
    console.log(`[ProductImporter] Stage 1: FETCH from AliExpress`);
    const fetched = await fetchProductsFromAliexpress(
      config.keywords,
      {
        name: 'fetch',
        batchSize: config.fetch?.batchSize || 50,
        delayBetweenItems: config.fetch?.delayBetweenItems || 200,
        delayBetweenBatches: config.fetch?.delayBetweenBatches || 1000,
        maxRetries: config.fetch?.maxRetries || 2,
      }
    );
    
    if (fetched.length === 0) {
      console.warn(`[ProductImporter] No products fetched, aborting pipeline`);
      return {
        fetched: [],
        deduplicated: [],
        enriched: [],
        translated: [],
        saved: { created: [], updated: [], skipped: [] },
        totalTime: Date.now() - startTime,
      };
    }
    
    // STAGE 2: DEDUPE
    console.log(`[ProductImporter] Stage 2: DEDUPLICATE & SANITIZE`);
    let deduplicated = sanitizeProducts(fetched);
    deduplicated = await deduplicateProducts(
      deduplicated,
      {
        name: 'dedupe',
        batchSize: config.dedupe?.batchSize || 50,
        delayBetweenItems: 0,
        delayBetweenBatches: 0,
        maxRetries: 0,
        minPrice: config.dedupe?.minPrice || 5,
        maxPrice: config.dedupe?.maxPrice || 10000,
        minRating: config.dedupe?.minRating || 2.5,
        minOrders: config.dedupe?.minOrders || 10,
      }
    );
    
    console.log(`[ProductImporter] Deduplicated: ${deduplicated.length} products\n`);
    
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
        batchSize: config.enrich?.batchSize || 5,
        delayBetweenItems: config.enrich?.delayBetweenItems || 300,
        delayBetweenBatches: config.enrich?.delayBetweenBatches || 2000,
        maxRetries: config.enrich?.maxRetries || 1,
        currencyTarget: 'PLN',
        exchangeRateUsdToPln: config.currencyRate || 4.0,
      }
    );
    
    console.log(`[ProductImporter] Enriched: ${enriched.length} products\n`);
    
    // STAGE 4: TRANSLATE (optional)
    let translated = enriched;
    if (config.translateToPolish !== false) {
      console.log(`[ProductImporter] Stage 4: TRANSLATE to Polish`);
      translated = await translateProducts(
        enriched,
        {
          name: 'translate',
          batchSize: config.translate?.batchSize || 10,
          delayBetweenItems: config.translate?.delayBetweenItems || 50,
          delayBetweenBatches: config.translate?.delayBetweenBatches || 300,
          maxRetries: config.translate?.maxRetries || 0,
        }
      );
      
      console.log(`[ProductImporter] Translated: ${translated.length} products\n`);
    }
    
    // STAGE 5: SAVE
    console.log(`[ProductImporter] Stage 5: SAVE to Firestore`);
    const saved = await saveProductsToFirestore(
      translated,
      {
        name: 'save',
        batchSize: config.save?.batchSize || 5,
        delayBetweenItems: config.save?.delayBetweenItems || 100,
        delayBetweenBatches: config.save?.delayBetweenBatches || 500,
        maxRetries: 0,
        skipExisting: config.save?.skipExisting !== false,
        jobId,
      }
    );
    
    console.log(`[ProductImporter] Saved: ${saved.created.length} created, ${saved.updated.length} updated, ${saved.skipped.length} skipped\n`);
    
    const totalTime = Date.now() - startTime;
    console.log(`${'='.repeat(60)}`);
    console.log(`[ProductImporter] Pipeline completed in ${(totalTime / 1000).toFixed(1)}s`);
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

export { fetchProductsFromAliexpress } from './stageFetch';
export { deduplicateProducts, sanitizeProducts } from './stageDedupe';
export { enrichProducts } from './stageEnrich';
export { translateProducts } from './stageTranslate';
export { saveProductsToFirestore } from './stageSave';
export type { EnrichedProduct, ImportJobConfig, ImportStageConfig } from './types';
