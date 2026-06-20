/**
 * Modular Product Importer - Atomic Import+Refine Architecture
 * 
 * New Flow (M6):
 * 1. Fetch (API) -> 1.5 Enhance (Details) -> 2. Dedupe -> 3. Refine (AI Genkit) -> 4. Save (Firestore)
 * 
 * consolidates Import + Refinement into a single atomic operation.
 */

import { fetchProductsFromAliexpress, fetchProductsFromConvertiser } from './stageFetch';
import { enhanceProductDetails } from './stageEnhance';
import { deduplicateProducts, sanitizeProducts } from './stageDedupe';
import { refineProductsBatch } from './stageEnrich';
// import { autoPromoteHotDeals } from './stageAutoPromote'; // Disabled for atomic refactor safety
import { saveProductsToFirestore } from './stageSave';
import { EnrichedProduct, ImportJobConfig, AliExpressProduct } from './types';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

// Helper to log to Firestore job document
async function logToJob(jobId: string | undefined, message: string, details?: any) {
  if (!jobId) return;
  try {
    const entry: any = {
      timestamp: new Date().toISOString(),
      message,
    };
    if (details !== undefined) {
      entry.details = details;
    }
    await adminDb.collection('import_jobs').doc(jobId).update({
      logs: FieldValue.arrayUnion(entry),
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
  categoryPath: string[]; // [Main, Sub, SubSub]
  categorySlugEN: string;
  subcategorySlugEN: string;
  subsubcategorySlugEN?: string;
  
  // Polish names for saving
  categoryNamePL?: string; 
  subcategoryNamePL?: string; 
  subsubcategoryNamePL?: string; 
  
  // Importer settings
  importerType?: 'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct';
  aliexpressCategoryIds?: string[];
  translateToPolish?: boolean; // Legacy flag, now implicit in Refiner
  currencyRate?: number;
  bypassRefinement?: boolean;
  
  // Stage configs
  fetch?: { batchSize?: number; delayBetweenItems?: number; delayBetweenBatches?: number; maxRetries?: number };
  dedupe?: { batchSize?: number; minPrice?: number; maxPrice?: number; minRating?: number; minOrders?: number };
  enrich?: { batchSize?: number; delayBetweenItems?: number; delayBetweenBatches?: number; maxRetries?: number };
  save?: { batchSize?: number; delayBetweenItems?: number; delayBetweenBatches?: number; skipExisting?: boolean };
}

export async function runProductImportPipeline(
  config: PipelineConfig
): Promise<{
  fetched: AliExpressProduct[];
  deduplicated: AliExpressProduct[];
  enriched: EnrichedProduct[];
  saved: { created: string[]; updated: string[]; skipped: string[] };
  totalTime: number;
}> {
  const startTime = Date.now();
  const jobId = config.jobId;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[ProductImporter] Starting NEW Atomic Pipeline for ${config.subcategorySlugEN}`);
  console.log(`[ProductImporter] Job ID: ${jobId || 'N/A'}`);
  console.log(`${'='.repeat(60)}\n`);
  
  await logToJob(jobId, `Starting Atomic Pipeline for ${config.subcategorySlugEN} (${config.keywords.join(', ')})`);
  
  try {
    // =========================================================================
    // STAGE 1: FETCH
    // =========================================================================
    const sourceLabel = config.importerType === 'convertiser' ? 'Convertiser' : 'AliExpress';
    console.log(`[ProductImporter] Stage 1: FETCH from ${sourceLabel}`);
    
    let fetched: AliExpressProduct[] = [];
    
    if (config.importerType === 'convertiser') {
      fetched = await fetchProductsFromConvertiser(
        config.keywords,
        {
          name: 'fetch-convertiser',
          batchSize: config.fetch?.batchSize || 50,
          delayBetweenItems: config.fetch?.delayBetweenItems || 100,
          delayBetweenBatches: config.fetch?.delayBetweenBatches || 500,
          maxRetries: config.fetch?.maxRetries || 1,
          importerType: 'convertiser',
        }
      );
    } else {
      fetched = await fetchProductsFromAliexpress(
        config.keywords,
        {
          name: 'fetch-ali',
          batchSize: config.fetch?.batchSize || 50,
          delayBetweenItems: config.fetch?.delayBetweenItems || 200,
          delayBetweenBatches: config.fetch?.delayBetweenBatches || 1000,
          maxRetries: config.fetch?.maxRetries || 2,
          importerType: config.importerType || 'keyword-search',
        }
      );
    }
    
    console.log(`[ProductImporter] ✅ Fetched: ${fetched.length} products`);
    await logToJob(jobId, `Stage 1: Fetched ${fetched.length} products`, { source: sourceLabel });
    
    if (fetched.length === 0) {
      console.error(`[ProductImporter] ❌ Aborting: No products fetched.`);
      await logToJob(jobId, `Aborting: No products fetched from ${sourceLabel}`);
      return {
        fetched: [],
        deduplicated: [],
        enriched: [],
        saved: { created: [], updated: [], skipped: [] },
        totalTime: Date.now() - startTime,
      };
    }
    
    // =========================================================================
    // STAGE 1.5: ENHANCE (Details)
    // =========================================================================
    console.log(`[ProductImporter] Stage 1.5: ENHANCE (Detail Fetching)`);
    // Note: Enhance is critical for specs that the Refiner will normalize
    const enhanced = await enhanceProductDetails(fetched, {
      name: 'enhance',
      batchSize: 10,
      delayBetweenItems: 300,
      delayBetweenBatches: 1000,
      maxRetries: 2,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002',
      skipIfHasDescription: false,
    });
    
    console.log(`[ProductImporter] ✅ Enhanced: ${enhanced.length} products`);
    await logToJob(jobId, `Stage 1.5: Enhanced ${enhanced.length} products with details`);
    
    // =========================================================================
    // STAGE 2: DEDUPE
    // =========================================================================
    console.log(`[ProductImporter] Stage 2: DEDUPLICATE & SANITIZE`);
    
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
    
    console.log(`[ProductImporter] ✅ Deduplicated: ${deduplicated.length} valid products`);
    await logToJob(jobId, `Stage 2: Deduplicated to ${deduplicated.length} products`);
    
    if (deduplicated.length === 0) {
      console.warn(`[ProductImporter] No products after deduplication, aborting`);
      return {
        fetched,
        deduplicated: [],
        enriched: [],
        saved: { created: [], updated: [], skipped: [] },
        totalTime: Date.now() - startTime,
      };
    }
    
    // Limit cap
    let forRefinement = deduplicated;
    if (config.maxProducts && forRefinement.length > config.maxProducts) {
      forRefinement = forRefinement.slice(0, config.maxProducts);
      console.log(`[ProductImporter] Limited to ${config.maxProducts} products for refinement`);
    }
    
    // =========================================================================
    // STAGE 3: REFINE (Atomic Enrichment + Localization)
    // =========================================================================
    console.log(`[ProductImporter] Stage 3: REFINE (AI Genkit - PL/EN/DE + Quality)`);
    await logToJob(jobId, `Stage 3: Starting AI Refinement (Gemini 1.5 Flash)...`);
    
    const enriched = await refineProductsBatch(
      forRefinement,
      config.categorySlugEN,
      config.subcategorySlugEN,
      config.subsubcategorySlugEN || config.subcategorySlugEN,
      {
        name: 'refine',
        batchSize: config.enrich?.batchSize ?? 5, // Process in small batches for Genkit stability
        delayBetweenItems: config.enrich?.delayBetweenItems ?? 500,
        delayBetweenBatches: config.enrich?.delayBetweenBatches ?? 2000,
        maxRetries: config.enrich?.maxRetries ?? 2,
        currencyRate: config.currencyRate ?? 4.0,
        bypassRefinement: config.bypassRefinement,
      }
    );
    
    console.log(`[ProductImporter] ✅ Refined: ${enriched.length} high-quality products`);
    await logToJob(jobId, `Stage 3: Successfully refined ${enriched.length} products`);

    if (enriched.length === 0) {
      console.warn(`[ProductImporter] No products passed Refinement (Quality Score / Errors), aborting`);
      await logToJob(jobId, `Stage 3 Warning: All products failed refinement.`);
      return {
        fetched,
        deduplicated,
        enriched: [],
        saved: { created: [], updated: [], skipped: [] },
        totalTime: Date.now() - startTime,
      };
    }

    // =========================================================================
    // STAGE 4: SAVE (Firestore)
    // =========================================================================
    console.log(`[ProductImporter] Stage 4: SAVE to Firestore`);
    await logToJob(jobId, `Stage 4: Saving to Firestore...`);
    
    const saved = await saveProductsToFirestore(
      enriched,
      {
        name: 'save',
        batchSize: config.save?.batchSize || 10,
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
    
    console.log(`[ProductImporter] ✅ Saved: ${saved.created.length} new, ${saved.updated.length} updated, ${saved.skipped.length} skipped`);
    
    // =========================================================================
    // SUMMARY
    // =========================================================================
    const totalTime = Date.now() - startTime;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[ProductImporter] ATOMIC PIPELINE COMPLETED in ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`[ProductImporter]   📦 Fetched:      ${fetched.length}`);
    console.log(`[ProductImporter]   🔍 Deduplicated: ${deduplicated.length}`);
    console.log(`[ProductImporter]   ✨ Refined:      ${enriched.length}`);
    console.log(`[ProductImporter]   💾 Created:      ${saved.created.length}`);
    console.log(`[ProductImporter]   📝 Updated:      ${saved.updated.length}`);
    console.log(`${'='.repeat(60)}\n`);
    
    await logToJob(jobId, `Pipeline Completed in ${(totalTime / 1000).toFixed(0)}s. Created: ${saved.created.length}, Updated: ${saved.updated.length}.`);

    return {
      fetched,
      deduplicated,
      enriched,
      saved,
      totalTime,
    };
    
  } catch (error: any) {
    console.error(`[ProductImporter] ❌ CRITICAL ERROR in Pipeline:`, error);
    await logToJob(jobId, `Critical Pipeline Failure: ${error.message}`);
    throw error;
  }
}
