/**
 * Allegro Product Ingestion
 * 
 * Handles importing products from Allegro into the platform
 */

// @ts-nocheck
import { addDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logging';
import { AllegroClient } from './client';
import { mapAllegroListingItemToProduct, mapAllegroProductToProduct } from './mappers';
import { AllegroSearchParams, AllegroOfferListingItem } from './types';
import { Product, ImportRun, ImportProfile } from '@/lib/types';
import { smartImportProduct } from '@/integrations/smart-importer';

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

  // Fetch full product details for AI processing
  const fullProductResponse = await client.getOfferDetails({ productId: item.id });
  if (!fullProductResponse || !fullProductResponse.offer) {
    logger.warn('Could not fetch full product details', { offerId: item.id });
    stats.skipped++;
    return;
  }
  const fullProduct = fullProductResponse.offer;

  // === AI PROCESSING PIPELINE - Using Smart Import Orchestration ===
  logger.debug('Running Smart Import pipeline', { offerId: item.id });

  const smartResult = await smartImportProduct({
    title: item.name,
    description: fullProduct.description,
    price: item.sellingMode.price.amount,
    originalPrice: undefined, // Allegro doesn't provide original price
    shippingCost: item.delivery?.lowestPrice?.amount || 0,
    rating: undefined, // Allegro seller ratings are separate; would need additional API call
    soldCount: item.stats?.visitsCount, // Use visits as proxy for popularity
    merchantRating: undefined, // Would need seller info API call
    merchant: item.seller?.login,
    source: 'allegro',
    externalId: item.id,
    importedBy: profile.createdBy,
  });

  // Skip low-quality products
  if (
    smartResult.qualityRecommendation === 'reject' ||
    smartResult.qualityScore < 50
  ) {
    logger.info('Product rejected by AI quality score', {
      offerId: item.id,
      score: smartResult.qualityScore,
      recommendation: smartResult.qualityRecommendation,
    });
    stats.skipped++;
    return;
  }

  // Map Allegro offer to platform Product with AI enhancements
  const productData = mapAllegroListingItemToProduct(item, {
    mainSlug: profile.mapping.targetMainCategory,
    subSlug: profile.mapping.targetSubCategory,
    subSubSlug: profile.mapping.targetSubSubCategory,
  });

  // Apply AI-suggested category if high confidence
  if (smartResult.category && smartResult.categoryConfidence >= 0.6) {
    productData.mainCategorySlug = smartResult.category.mainCategorySlug;
    productData.subCategorySlug = smartResult.category.subCategorySlug;
    productData.subSubCategorySlug = smartResult.category.subSubCategorySlug;
  }

  // Apply AI-generated content
  if (smartResult.generatedContent) {
    productData.name = smartResult.generatedContent.marketingTitle || productData.name;
    productData.description = smartResult.generatedContent.shortDescription || productData.description;
    productData.longDescription = smartResult.generatedContent.htmlContent || productData.longDescription;
  }

  // Attach AI metadata
  if (!productData.ai) productData.ai = {};
  productData.ai.quality = {
    score: smartResult.qualityScore,
    recommendation: smartResult.qualityRecommendation,
    reasoning: smartResult.qualityReasoning,
    scoredAt: new Date().toISOString(),
  };
  
  if (smartResult.generatedContent) {
    productData.ai.generatedContent = {
      marketingTitle: smartResult.generatedContent.marketingTitle,
      shortDescription: smartResult.generatedContent.shortDescription,
      htmlContent: smartResult.generatedContent.htmlContent,
      generatedAt: new Date().toISOString(),
    };
  }

  if (smartResult.category) {
    productData.ai.categoryMapping = {
      suggestedPath: [
        smartResult.category.mainCategorySlug,
        smartResult.category.subCategorySlug,
        smartResult.category.subSubCategorySlug,
      ].filter(Boolean) as string[],
      confidence: smartResult.categoryConfidence,
      reasoning: smartResult.categoryReasoning,
    };
  }

  // Apply price markup if configured
  if (profile.mapping.priceMarkup) {
    productData.price = productData.price * (1 + profile.mapping.priceMarkup / 100);
  }

  // Set default status
  productData.status = profile.mapping.defaultStatus || 'draft';

  if (!dryRun) {
    // Save to Firestore
    await addDoc(collection(db, 'products'), productData);
    logger.info('Allegro product imported with Smart Import', {
      offerId: item.id,
      name: productData.name,
      qualityScore: smartResult.qualityScore,
      processingTimeMs: smartResult.processingTimeMs,
    });
  } else {
    logger.info('Dry run: would import product', {
      offerId: item.id,
      name: productData.name,
      qualityScore: smartResult.qualityScore,
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
