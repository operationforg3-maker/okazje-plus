// @ts-nocheck
'use server';
import { smartImportProduct } from '@/integrations/smart-importer';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, setDoc, getDocs, query, where, limit as qLimit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ImportRun, ImportProfile, ImportError } from '@/lib/types';
import { AliExpressClient } from './client';
import { mapAliExpressResponseToProduct } from './mappers';
import { AliExpressSearchParams } from './types';
import { logger, createImportLogger } from '@/lib/logging';
import { ProductSchema, PriceHistoryEntrySchema } from '@/lib/schema';

// AI orchestration (now handled by smartImportProduct)
// import { aiDealQualityScore } from '@/ai/flows/aliexpress/aiDealQualityScore';
// import { aiProductEnrichmentPL } from '@/ai/flows/aliexpress/aiProductEnrichmentPL';
// import { aiSuggestCategory } from '@/ai/flows/aliexpress/aiSuggestCategory';

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
    
    const searchResponse = await client.searchProducts(searchParams);
    const products = searchResponse.products || [];
    
    result.stats.fetched = products.length;
    importLogger.info('Fetched products', { count: products.length });
    
    // Process each product
    for (const aliProduct of products) {
      try {
        // Fetch deep details for PL context and fail-fast on geo issues
        const details = await client.getProductDetails({ productId: aliProduct.item_id });

        // Fail-fast: API-level error or item unavailable/invalid shipping
        const rootKey = Object.keys(details || {})[0];
        const payload = rootKey ? details[rootKey]?.result || details[rootKey] : details;
        const raw = payload?.products?.[0] || payload?.product || payload || {};
        const shipDaysRaw = raw.ship_to_days || raw.deliveryDays;
        const shipDays = typeof shipDaysRaw === 'string' ? parseInt(shipDaysRaw, 10) : shipDaysRaw;
        if (!raw || payload?.resp_code && payload.resp_code !== 200) {
          importLogger.warn('AliExpress details returned error - skipping', { item: aliProduct.item_id });
          result.stats.skipped++;
          continue;
        }
        if (!shipDays || Number.isNaN(shipDays) || shipDays <= 0) {
          importLogger.info('Item unavailable for PL (ship_to_days invalid) - skipping', { item: aliProduct.item_id });
          result.stats.skipped++;
          continue;
        }

        // Map to Universal Product Schema
        const universal = mapAliExpressResponseToProduct({ ...raw });

        // Upsert by externalId + source
        const existingQ = query(
          collection(db, 'products'),
          where('externalId', '==', universal.externalId),
          where('source', '==', 'aliexpress'),
          qLimit(1)
        );
        const existingSnap = await getDocs(existingQ);

        if (dryRun) {
          if (!existingSnap.empty) result.stats.wouldUpdate!++; else result.stats.wouldCreate!++;
          continue;
        }

        if (existingSnap.empty) {
          await addDoc(collection(db, 'products'), {
            ...universal,
            createdAt: serverTimestamp(),
          });
          result.stats.created!++;
        } else {
          const docRef = existingSnap.docs[0].ref;
          // Preserve manually edited fields by not overwriting title/description
          const toUpdate: any = {
            price: universal.price,
            logistics: universal.logistics,
            updatedAt: serverTimestamp(),
          };
          // Append price history entry
          const newEntry = PriceHistoryEntrySchema.parse({ date: new Date().toISOString(), price: universal.price!.current, currency: 'PLN' });
          toUpdate.priceHistory = [ ...(existingSnap.docs[0].data().priceHistory || []), newEntry ];
          await updateDoc(docRef, toUpdate);
          result.stats.updated!++;
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
 * Duplicate check no longer needed (upsert by externalId handled in-place)
 */

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
