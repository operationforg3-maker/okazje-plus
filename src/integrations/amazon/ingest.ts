/**
 * Amazon Product Ingestion
 * 
 * Handles importing products from Amazon into the platform
 */

import { addDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logging';
import { AmazonClient } from './client';
import { mapAmazonProductToProduct } from './mappers';
import { AmazonSearchParams, AmazonProduct } from './types';
import { Product, ImportRun, ImportProfile } from '@/lib/types';

/**
 * Import products from Amazon based on profile
 */
export async function ingestAmazonProducts(
  client: AmazonClient,
  profile: ImportProfile,
  dryRun: boolean = false
): Promise<ImportRun> {
  const startTime = Date.now();
  
  const runData: Omit<ImportRun, 'id'> = {
    profileId: profile.id,
    vendorId: 'amazon',
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
  
  logger.info('Starting Amazon import', {
    profileId: profile.id,
    runId: runRef.id,
    dryRun,
  });

  try {
    // Build search parameters from profile filters
    const searchParams: AmazonSearchParams = {
      keywords: profile.filters.searchQuery || '',
      minPrice: profile.filters.minPrice,
      maxPrice: profile.filters.maxPrice,
      minRating: profile.filters.minRating,
      category: profile.filters.categoryFilter,
      limit: profile.maxItemsPerRun || 50,
      page: 1,
    };

    // Search for products
    const searchResponse = await client.searchProducts(searchParams);
    runData.stats.fetched = searchResponse.products.length;

    // Process each product
    for (const amazonProduct of searchResponse.products) {
      try {
        await processAmazonProduct(
          amazonProduct,
          profile,
          dryRun,
          runData.stats
        );
      } catch (error) {
        logger.error('Failed to process Amazon product', {
          asin: amazonProduct.asin,
          error,
        });
        runData.stats.errors++;
      }
    }

    // Update run status
    runData.status = 'completed';
    runData.finishedAt = new Date().toISOString();
    runData.durationMs = Date.now() - startTime;

    logger.info('Amazon import completed', {
      runId: runRef.id,
      stats: runData.stats,
    });

  } catch (error) {
    logger.error('Amazon import failed', { error, profileId: profile.id });
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
 * Process a single Amazon product
 */
async function processAmazonProduct(
  amazonProduct: AmazonProduct,
  profile: ImportProfile,
  dryRun: boolean,
  stats: ImportRun['stats']
): Promise<void> {
  // Apply filters
  if (!passesFilters(amazonProduct, profile.filters)) {
    logger.debug('Product filtered out', { asin: amazonProduct.asin });
    stats.skipped++;
    return;
  }

  // Check for duplicates
  const existingProduct = await findExistingProduct(amazonProduct.asin);
  
  if (existingProduct) {
    if (profile.deduplicationStrategy === 'skip') {
      logger.debug('Skipping duplicate product', { asin: amazonProduct.asin });
      stats.skipped++;
      return;
    } else if (profile.deduplicationStrategy === 'update') {
      // TODO: Implement update logic
      logger.debug('Updating existing product', {
        asin: amazonProduct.asin,
        existingId: existingProduct.id,
      });
      stats.updated++;
      return;
    }
  }

  // Map Amazon product to platform Product
  const productData = mapAmazonProductToProduct(amazonProduct, {
    mainSlug: profile.mapping.targetMainCategory,
    subSlug: profile.mapping.targetSubCategory,
    subSubSlug: profile.mapping.targetSubSubCategory,
  });

  // Apply price markup if configured
  if (profile.mapping.priceMarkup) {
    productData.price = productData.price * (1 + profile.mapping.priceMarkup / 100);
    if (productData.originalPrice) {
      productData.originalPrice = productData.originalPrice * (1 + profile.mapping.priceMarkup / 100);
    }
  }

  // Set default status
  productData.status = profile.mapping.defaultStatus || 'draft';

  if (!dryRun) {
    // Save to Firestore
    await addDoc(collection(db, 'products'), productData);
    logger.info('Amazon product imported', {
      asin: amazonProduct.asin,
      name: productData.name,
    });
  } else {
    logger.info('Dry run: would import product', {
      asin: amazonProduct.asin,
      name: productData.name,
    });
  }

  stats.created++;
}

/**
 * Check if product passes profile filters
 */
function passesFilters(product: AmazonProduct, filters: ImportProfile['filters']): boolean {
  if (filters.minPrice && product.price.current < filters.minPrice) return false;
  if (filters.maxPrice && product.price.current > filters.maxPrice) return false;
  if (filters.minRating && (!product.rating || product.rating.score < filters.minRating)) return false;
  if (filters.minDiscount) {
    const discount = product.price.original
      ? ((product.price.original - product.price.current) / product.price.original) * 100
      : 0;
    if (discount < filters.minDiscount) return false;
  }
  if (filters.shippingType === 'free' && product.shippingInfo && !product.shippingInfo.free) return false;
  
  return true;
}

/**
 * Find existing product by Amazon ASIN
 */
async function findExistingProduct(asin: string): Promise<Product | null> {
  const productsRef = collection(db, 'products');
  const q = query(
    productsRef,
    where('metadata.originalId', '==', asin),
    where('metadata.source', '==', 'manual'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
}
