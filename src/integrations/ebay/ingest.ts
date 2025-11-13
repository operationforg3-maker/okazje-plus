/**
 * eBay Product Ingestion
 * 
 * Handles importing products from eBay into the platform
 */

import { addDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logging';
import { EbayClient } from './client';
import { mapEbayItemSummaryToProduct } from './mappers';
import { EbaySearchParams, EbayItemSummary } from './types';
import { Product, ImportRun, ImportProfile } from '@/lib/types';

/**
 * Import products from eBay based on profile
 */
export async function ingestEbayProducts(
  client: EbayClient,
  profile: ImportProfile,
  dryRun: boolean = false
): Promise<ImportRun> {
  const startTime = Date.now();
  
  const runData: Omit<ImportRun, 'id'> = {
    profileId: profile.id,
    vendorId: 'ebay',
    status: 'running',
    dryRun,
    stats: {
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    },
    startedAt: new Date().toISOString(),
    triggeredBy: 'manual',
  };

  const runRef = await addDoc(collection(db, 'import_runs'), runData);
  
  logger.info('Starting eBay import', {
    profileId: profile.id,
    runId: runRef.id,
    dryRun,
  });

  try {
    // Build search parameters from profile filters
    const filters: string[] = [];
    
    if (profile.filters.minPrice || profile.filters.maxPrice) {
      const min = profile.filters.minPrice || 0;
      const max = profile.filters.maxPrice || 999999;
      filters.push(`price:[${min}..${max}],priceCurrency:PLN`);
    }
    
    if (profile.filters.shippingType === 'free') {
      filters.push('deliveryOptions:{FIXED_COST|FREE}');
    }

    const searchParams: EbaySearchParams = {
      q: profile.filters.searchQuery,
      filter: filters.join('|'),
      limit: Math.min(profile.maxItemsPerRun || 50, 200), // eBay max is 200
      offset: 0,
    };

    // Search for items
    const searchResponse = await client.searchItems(searchParams);
    const items = searchResponse.itemSummaries || [];
    runData.stats.fetched = items.length;

    // Process each item
    for (const item of items) {
      try {
        await processEbayItem(
          item,
          profile,
          dryRun,
          runData.stats
        );
      } catch (error) {
        logger.error('Failed to process eBay item', {
          itemId: item.itemId,
          error,
        });
        runData.stats.errors++;
      }
    }

    // Update run status
    runData.status = 'completed';
    runData.finishedAt = new Date().toISOString();
    runData.durationMs = Date.now() - startTime;

    logger.info('eBay import completed', {
      runId: runRef.id,
      stats: runData.stats,
    });

  } catch (error) {
    logger.error('eBay import failed', { error, profileId: profile.id });
    runData.status = 'failed';
    runData.finishedAt = new Date().toISOString();
    runData.durationMs = Date.now() - startTime;
    runData.errorSummary = [
      {
        code: 'UNKNOWN',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    ];
  }

  return { id: runRef.id, ...runData };
}

/**
 * Process a single eBay item
 */
async function processEbayItem(
  item: EbayItemSummary,
  profile: ImportProfile,
  dryRun: boolean,
  stats: ImportRun['stats']
): Promise<void> {
  // Apply filters
  if (!passesFilters(item, profile.filters)) {
    logger.debug('Item filtered out', { itemId: item.itemId });
    stats.skipped++;
    return;
  }

  // Check for duplicates
  const existingProduct = await findExistingProduct(item.itemId);
  
  if (existingProduct) {
    if (profile.deduplicationStrategy === 'skip') {
      logger.debug('Skipping duplicate product', { itemId: item.itemId });
      stats.skipped++;
      return;
    } else if (profile.deduplicationStrategy === 'update') {
      // TODO: Implement update logic
      logger.debug('Updating existing product', {
        itemId: item.itemId,
        existingId: existingProduct.id,
      });
      stats.updated++;
      return;
    }
  }

  // Map eBay item to platform Product
  const productData = mapEbayItemSummaryToProduct(item, {
    mainSlug: profile.mapping.targetMainCategory,
    subSlug: profile.mapping.targetSubCategory,
    subSubSlug: profile.mapping.targetSubSubCategory,
  });

  // Apply price markup if configured
  if (profile.mapping.priceMarkup) {
    productData.price = productData.price * (1 + profile.mapping.priceMarkup / 100);
  }

  // Set default status
  productData.status = profile.mapping.defaultStatus || 'draft';

  if (!dryRun) {
    // Save to Firestore
    await addDoc(collection(db, 'products'), productData);
    logger.info('eBay product imported', {
      itemId: item.itemId,
      name: productData.name,
    });
  } else {
    logger.info('Dry run: would import product', {
      itemId: item.itemId,
      name: productData.name,
    });
  }

  stats.created++;
}

/**
 * Check if item passes profile filters
 */
function passesFilters(item: EbayItemSummary, filters: ImportProfile['filters']): boolean {
  const price = parseFloat(item.price.value);
  
  if (filters.minPrice && price < filters.minPrice) return false;
  if (filters.maxPrice && price > filters.maxPrice) return false;
  
  if (filters.shippingType === 'free') {
    const hasFreeShipping = item.shippingOptions?.some(
      opt => opt.shippingCostType === 'FIXED' && opt.shippingCost?.value === '0'
    );
    if (!hasFreeShipping) return false;
  }
  
  return true;
}

/**
 * Find existing product by eBay item ID
 */
async function findExistingProduct(itemId: string): Promise<Product | null> {
  const productsRef = collection(db, 'products');
  const q = query(
    productsRef,
    where('metadata.originalId', '==', itemId),
    where('metadata.source', '==', 'manual'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
}
