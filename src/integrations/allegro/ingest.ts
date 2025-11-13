/**
 * Allegro Product Ingestion
 * 
 * Handles importing products from Allegro into the platform
 */

import { addDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logging';
import { AllegroClient } from './client';
import { mapAllegroListingItemToProduct, mapAllegroProductToProduct } from './mappers';
import { AllegroSearchParams, AllegroOfferListingItem } from './types';
import { Product, ImportRun, ImportProfile } from '@/lib/types';

/**
 * Import products from Allegro based on profile
 */
export async function ingestAllegroProducts(
  client: AllegroClient,
  profile: ImportProfile,
  dryRun: boolean = false
): Promise<ImportRun> {
  const startTime = Date.now();
  
  const runData: Omit<ImportRun, 'id'> = {
    profileId: profile.id,
    vendorId: 'allegro',
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
  
  logger.info('Starting Allegro import', {
    profileId: profile.id,
    runId: runRef.id,
    dryRun,
  });

  try {
    // Build search parameters from profile filters
    const searchParams: AllegroSearchParams = {
      phrase: profile.filters.searchQuery,
      'parameter.price.from': profile.filters.minPrice,
      'parameter.price.to': profile.filters.maxPrice,
      'delivery.free': profile.filters.shippingType === 'free',
      limit: Math.min(profile.maxItemsPerRun || 50, 100), // Allegro max is 100
      offset: 0,
    };

    // Search for offers
    const searchResponse = await client.searchOffers(searchParams);
    const allItems = [...searchResponse.items.promoted, ...searchResponse.items.regular];
    runData.stats.fetched = allItems.length;

    // Process each offer
    for (const item of allItems) {
      try {
        await processAllegroOffer(
          item,
          client,
          profile,
          dryRun,
          runData.stats
        );
      } catch (error) {
        logger.error('Failed to process Allegro offer', {
          offerId: item.id,
          error,
        });
        runData.stats.errors++;
      }
    }

    // Update run status
    runData.status = 'completed';
    runData.finishedAt = new Date().toISOString();
    runData.durationMs = Date.now() - startTime;

    logger.info('Allegro import completed', {
      runId: runRef.id,
      stats: runData.stats,
    });

  } catch (error) {
    logger.error('Allegro import failed', { error, profileId: profile.id });
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
 * Process a single Allegro offer
 */
async function processAllegroOffer(
  item: AllegroOfferListingItem,
  client: AllegroClient,
  profile: ImportProfile,
  dryRun: boolean,
  stats: ImportRun['stats']
): Promise<void> {
  // Apply filters
  if (!passesFilters(item, profile.filters)) {
    logger.debug('Offer filtered out', { offerId: item.id });
    stats.skipped++;
    return;
  }

  // Check for duplicates
  const existingProduct = await findExistingProduct(item.id);
  
  if (existingProduct) {
    if (profile.deduplicationStrategy === 'skip') {
      logger.debug('Skipping duplicate product', { offerId: item.id });
      stats.skipped++;
      return;
    } else if (profile.deduplicationStrategy === 'update') {
      // TODO: Implement update logic
      logger.debug('Updating existing product', {
        offerId: item.id,
        existingId: existingProduct.id,
      });
      stats.updated++;
      return;
    }
  }

  // Map Allegro offer to platform Product
  const productData = mapAllegroListingItemToProduct(item, {
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
    logger.info('Allegro product imported', {
      offerId: item.id,
      name: productData.name,
    });
  } else {
    logger.info('Dry run: would import product', {
      offerId: item.id,
      name: productData.name,
    });
  }

  stats.created++;
}

/**
 * Check if offer passes profile filters
 */
function passesFilters(item: AllegroOfferListingItem, filters: ImportProfile['filters']): boolean {
  const price = item.sellingMode.price.amount;
  
  if (filters.minPrice && price < filters.minPrice) return false;
  if (filters.maxPrice && price > filters.maxPrice) return false;
  if (filters.shippingType === 'free' && !item.delivery.availableForFree) return false;
  
  // Check if offer is active
  if (item.publication && item.publication.status !== 'ACTIVE') return false;
  
  return true;
}

/**
 * Find existing product by Allegro offer ID
 */
async function findExistingProduct(offerId: string): Promise<Product | null> {
  const productsRef = collection(db, 'products');
  const q = query(
    productsRef,
    where('metadata.originalId', '==', offerId),
    where('metadata.source', '==', 'manual'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
}
