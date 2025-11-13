/**
 * AliExpress ingestion pipeline
 * 
 * Orchestrates the import process: fetch, transform, validate, and store products/deals
 * 
 * TODO M2:
 * - Implement deduplication logic (check for existing products)
 * - Add AI-based category suggestion
 * - Add embedding-based similarity detection
 * - Implement batch processing for large imports
 * - Add progress tracking for long-running imports
 */

'use server';

import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ImportRun, ImportProfile, ImportError, Product, Deal } from '@/lib/types';
import { AliExpressClient } from './client';
import { mapToProduct, mapToDeal, validateProduct, MapperConfig } from './mappers';
import { AliExpressSearchParams } from './types';
import { logger, createImportLogger } from '@/lib/logging';
import { queueProductForIndexing, queueDealForIndexing } from '@/search/typesenseQueue';

/**
 * Result of an import run
 */
export interface IngestResult {
  ok: boolean;
  dryRun: boolean;
  stats: {
    fetched: number;
    wouldCreate?: number; // For dry-run
    wouldUpdate?: number; // For dry-run
    created?: number; // For actual run
    updated?: number; // For actual run
    skipped: number; // Items skipped (duplicates, filters, etc)
    duplicates: number;
    errors: number;
  };
  importRunId?: string;
  errors?: ImportError[];
}

/**
 * Options for ingestion
 */
export interface IngestOptions {
  dryRun?: boolean;
  maxItems?: number;
  triggeredBy?: 'scheduled' | 'manual';
  triggeredByUid?: string;
}

/**
 * Run an import based on an ImportProfile
 */
export async function runImport(
  profileId: string,
  options: IngestOptions = {}
): Promise<IngestResult> {
  const startTime = Date.now();
  const dryRun = options.dryRun ?? false;
  
  // Initialize result
  const result: IngestResult = {
    ok: true,
    dryRun,
    stats: {
      fetched: 0,
      duplicates: 0,
      errors: 0,
      skipped: 0,
      ...(dryRun 
        ? { wouldCreate: 0, wouldUpdate: 0 } 
        : { created: 0, updated: 0 }
      )
    },
    errors: []
  };
  
  try {
    // Load import profile
    const profileRef = doc(db, 'importProfiles', profileId);
    const profileSnap = await getDoc(profileRef);
    
    if (!profileSnap.exists()) {
      throw new Error(`Import profile ${profileId} not found`);
    }
    
    const profile = { id: profileSnap.id, ...profileSnap.data() } as ImportProfile;
    
    if (!profile.enabled) {
      throw new Error(`Import profile ${profileId} is disabled`);
    }
    
    // Create import run record (even for dry-run, for tracking)
    const importRun: Omit<ImportRun, 'id'> = {
      profileId,
      vendorId: profile.vendorId,
      status: 'running',
      dryRun,
      stats: {
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        duplicates: 0
      },
      startedAt: new Date().toISOString(),
      triggeredBy: options.triggeredBy || 'manual',
      triggeredByUid: options.triggeredByUid
    };
    
    const importRunRef = await addDoc(collection(db, 'importRuns'), importRun);
    result.importRunId = importRunRef.id;
    
    const importLogger = createImportLogger(importRunRef.id, profileId);
    importLogger.info('Starting import run', { 
      dryRun, 
      profile: profile.name 
    });
    
    // Create AliExpress client
    // TODO M2: Pass actual credentials from profile/vendor config
    const client = new AliExpressClient({
      appKey: process.env.ALIEXPRESS_APP_KEY || 'STUB',
      appSecret: process.env.ALIEXPRESS_APP_SECRET || 'STUB'
    });
    
    // Build search parameters from profile filters
    const searchParams: AliExpressSearchParams = {
      q: profile.filters.searchQuery || '',
      minPrice: profile.filters.minPrice,
      maxPrice: profile.filters.maxPrice,
      minRating: profile.filters.minRating,
      minDiscount: profile.filters.minDiscount,
      shippingType: profile.filters.shippingType,
      limit: options.maxItems || profile.maxItemsPerRun || 50
    };
    
    // Fetch products from AliExpress
    importLogger.info('Fetching products from AliExpress', searchParams);
    
    // TODO M2: Replace with actual API call when client is implemented
    // For now, use stub data
    const searchResponse = await client.searchProducts(searchParams);
    const products = searchResponse.products || [];
    
    result.stats.fetched = products.length;
    importLogger.info('Fetched products', { count: products.length });
    
    // Process each product
    const mapperConfig: MapperConfig = {
      targetMainCategory: profile.mapping.targetMainCategory,
      targetSubCategory: profile.mapping.targetSubCategory,
      targetSubSubCategory: profile.mapping.targetSubSubCategory,
      priceMarkup: profile.mapping.priceMarkup,
      defaultStatus: profile.mapping.defaultStatus,
      importedBy: profile.createdBy
    };
    
    for (const aliProduct of products) {
      try {
        // Validate product
        const validation = validateProduct(aliProduct, profile.filters);
        if (!validation.valid) {
          importLogger.debug('Product validation failed', {
            productId: aliProduct.item_id,
            reason: validation.reason
          });
          result.stats.errors++;
          result.stats.skipped++;
          result.errors?.push({
            code: 'VALIDATION',
            message: validation.reason || 'Validation failed',
            itemId: aliProduct.item_id,
            timestamp: new Date().toISOString()
          });
          continue;
        }
        
        // Map to internal types
        const product = mapToProduct(aliProduct, mapperConfig);
        const deal = mapToDeal(aliProduct, mapperConfig, profile.createdBy);
        
        // Check for duplicates
        // TODO M2: Implement proper deduplication
        const isDuplicate = await checkDuplicate(aliProduct.item_id);
        
        if (isDuplicate) {
          result.stats.duplicates++;
          result.stats.skipped++;
          importLogger.debug('Duplicate detected', { productId: aliProduct.item_id });
          
          if (profile.deduplicationStrategy === 'skip') {
            continue;
          }
          // TODO M2: Implement 'update' strategy
        }
        
        // Store (or simulate in dry-run)
        if (dryRun) {
          // Dry run - just count what would happen
          if (isDuplicate) {
            result.stats.wouldUpdate!++;
          } else {
            result.stats.wouldCreate!++;
          }
        } else {
          // Actually create the records
          const productRef = await addDoc(collection(db, 'products'), {
            ...product,
            createdAt: serverTimestamp()
          });
          
          if (dryRun) {
            result.stats.wouldCreate!++;
          } else {
            result.stats.created!++;
          }
          
          importLogger.info('Created product', { productId: productRef.id });
          
          // Queue for Typesense indexing
          await queueProductForIndexing(productRef.id);
          
          // Create deal if applicable
          if (deal) {
            const dealRef = await addDoc(collection(db, 'deals'), {
              ...deal,
              createdAt: serverTimestamp()
            });
            
            result.stats.created!++;
            importLogger.info('Created deal', { dealId: dealRef.id });
            
            await queueDealForIndexing(dealRef.id);
          }
        }
      } catch (error) {
        result.stats.errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        importLogger.error('Error processing product', {
          productId: aliProduct.item_id,
          error: errorMessage
        });
        
        result.errors?.push({
          code: 'UNKNOWN',
          message: errorMessage,
          itemId: aliProduct.item_id,
          timestamp: new Date().toISOString(),
          details: error
        });
      }
    }
    
    // Update import run with final stats
    const durationMs = Date.now() - startTime;
    await updateDoc(importRunRef, {
      status: 'completed',
      stats: {
        fetched: result.stats.fetched,
        created: result.stats.created || result.stats.wouldCreate || 0,
        updated: result.stats.updated || result.stats.wouldUpdate || 0,
        skipped: result.stats.skipped,
        errors: result.stats.errors,
        duplicates: result.stats.duplicates
      },
      finishedAt: new Date().toISOString(),
      durationMs,
      errorSummary: result.errors
    });
    
    importLogger.info('Import run completed', {
      durationMs,
      stats: result.stats
    });
    
  } catch (error) {
    result.ok = false;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Import run failed', {
      profileId,
      error: errorMessage
    });
    
    result.errors?.push({
      code: 'UNKNOWN',
      message: errorMessage,
      timestamp: new Date().toISOString(),
      details: error
    });
    
    // Update import run status if we created one
    if (result.importRunId) {
      try {
        await updateDoc(doc(db, 'importRuns', result.importRunId), {
          status: 'failed',
          stats: {
            fetched: result.stats.fetched,
            created: result.stats.created || result.stats.wouldCreate || 0,
            updated: result.stats.updated || result.stats.wouldUpdate || 0,
            skipped: result.stats.skipped,
            errors: result.stats.errors,
            duplicates: result.stats.duplicates
          },
          finishedAt: new Date().toISOString(),
          errorSummary: result.errors
        });
      } catch (updateError) {
        logger.error('Failed to update import run status', { error: updateError });
      }
    }
  }
  
  return result;
}

/**
 * Check if a product with this original ID already exists
 * 
 * TODO M2: Implement actual duplicate detection
 * - Query Firestore for existing products with same originalId
 * - Use embedding-based similarity for soft duplicates
 */
async function checkDuplicate(originalId: string): Promise<boolean> {
  // TODO M2: Implement duplicate check
  // const productsRef = collection(db, 'products');
  // const q = query(
  //   productsRef,
  //   where('metadata.originalId', '==', originalId),
  //   where('metadata.source', '==', 'aliexpress')
  // );
  // const snapshot = await getDocs(q);
  // return !snapshot.empty;
  
  return false; // Stub - assume no duplicates
}

/**
 * Get import run status
 */
export async function getImportRunStatus(importRunId: string): Promise<ImportRun | null> {
  const runRef = doc(db, 'importRuns', importRunId);
  const runSnap = await getDoc(runRef);
  
  if (!runSnap.exists()) {
    return null;
  }
  
  return { id: runSnap.id, ...runSnap.data() } as ImportRun;
}
