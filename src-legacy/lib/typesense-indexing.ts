/**
 * Typesense Indexing Service (M2)
 * 
 * Handles batch indexing of products and deals to Typesense
 * Implements faceting and search optimization
 */

import { logger } from '@/lib/logging';
import { Product, Deal, IndexingJob, SearchFacet } from '@/lib/types';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

// Typesense client would be initialized here
// import Typesense from 'typesense';

/**
 * Create indexing job
 */
export async function createIndexingJob(
  collectionName: 'products' | 'deals',
  operation: IndexingJob['operation'],
  itemIds: string[],
  triggeredBy: IndexingJob['triggeredBy'],
  triggeredByUid?: string
): Promise<IndexingJob> {
  try {
    const jobRef = doc(collection(db, 'indexingJobs'));
    const now = new Date().toISOString();

    const job: IndexingJob = {
      id: jobRef.id,
      collection: collectionName,
      operation,
      itemIds,
      status: 'pending',
      batchSize: itemIds.length,
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      startedAt: now,
      triggeredBy,
      triggeredByUid,
    };

    await setDoc(jobRef, {
      ...job,
      startedAt: Timestamp.fromDate(new Date(job.startedAt)),
      finishedAt: null,
    });

    logger.info('Indexing job created', {
      jobId: job.id,
      collection: collectionName,
      operation,
      itemCount: itemIds.length,
    });

    return job;
  } catch (error) {
    logger.error('Failed to create indexing job', { collectionName, operation, error });
    throw error;
  }
}

/**
 * Index a single product to Typesense
 */
async function indexProduct(product: Product): Promise<void> {
  try {
    logger.debug('Indexing product', { productId: product.id });

    // TODO: Implement actual Typesense indexing
    // const client = getTypesenseClient();
    // await client.collections('products').documents().upsert({
    //   id: product.id,
    //   name: product.name,
    //   description: product.description,
    //   price: product.price,
    //   originalPrice: product.originalPrice,
    //   discountPercent: product.discountPercent,
    //   mainCategorySlug: product.mainCategorySlug,
    //   subCategorySlug: product.subCategorySlug,
    //   rating: product.ratingCard.average,
    //   reviewCount: product.ratingCard.count,
    //   image: product.image,
    //   status: product.status,
    //   // Add faceting fields
    //   categoryPath: `${product.mainCategorySlug} > ${product.subCategorySlug}`,
    //   priceRange: getPriceRange(product.price),
    //   ratingRange: getRatingRange(product.ratingCard.average),
    // });

    logger.debug('Product indexed successfully', { productId: product.id });
  } catch (error) {
    logger.error('Failed to index product', { productId: product.id, error });
    throw error;
  }
}

/**
 * Index a single deal to Typesense
 */
async function indexDeal(deal: Deal): Promise<void> {
  try {
    logger.debug('Indexing deal', { dealId: deal.id });

    // TODO: Implement actual Typesense indexing
    // const client = getTypesenseClient();
    // await client.collections('deals').documents().upsert({
    //   id: deal.id,
    //   title: deal.title,
    //   description: deal.description,
    //   price: deal.price,
    //   originalPrice: deal.originalPrice,
    //   mainCategorySlug: deal.mainCategorySlug,
    //   subCategorySlug: deal.subCategorySlug,
    //   temperature: deal.temperature,
    //   voteCount: deal.voteCount,
    //   commentsCount: deal.commentsCount,
    //   merchant: deal.merchant,
    //   image: deal.image,
    //   status: deal.status,
    //   postedAt: new Date(deal.postedAt).getTime() / 1000,
    //   // Add faceting fields
    //   categoryPath: `${deal.mainCategorySlug} > ${deal.subCategorySlug}`,
    //   priceRange: getPriceRange(deal.price),
    //   discountPercent: deal.originalPrice
    //     ? Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)
    //     : 0,
    // });

    logger.debug('Deal indexed successfully', { dealId: deal.id });
  } catch (error) {
    logger.error('Failed to index deal', { dealId: deal.id, error });
    throw error;
  }
}

/**
 * Get price range for faceting
 */
function getPriceRange(price: number): string {
  if (price < 50) return '0-50';
  if (price < 100) return '50-100';
  if (price < 200) return '100-200';
  if (price < 500) return '200-500';
  if (price < 1000) return '500-1000';
  return '1000+';
}

/**
 * Get rating range for faceting
 */
function getRatingRange(rating: number): string {
  if (rating >= 4.5) return '4.5+';
  if (rating >= 4.0) return '4.0-4.5';
  if (rating >= 3.5) return '3.5-4.0';
  if (rating >= 3.0) return '3.0-3.5';
  return '<3.0';
}

/**
 * Process indexing job
 */
export async function processIndexingJob(jobId: string): Promise<void> {
  try {
    logger.info('Processing indexing job', { jobId });

    // Get job
    const jobRef = doc(db, 'indexingJobs', jobId);
    const jobDoc = await getDocs(query(collection(db, 'indexingJobs'), where('id', '==', jobId)));

    if (jobDoc.empty) {
      throw new Error(`Indexing job ${jobId} not found`);
    }

    const job = { id: jobDoc.docs[0].id, ...jobDoc.docs[0].data() } as IndexingJob;

    // Update status to processing
    await updateDoc(jobRef, {
      status: 'processing',
    });

    const errors: IndexingJob['errors'] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each item
    for (const itemId of job.itemIds) {
      try {
        // Get the item
        const itemRef = doc(db, job.collection, itemId);
        const itemDoc = await getDocs(
          query(collection(db, job.collection), where('id', '==', itemId))
        );

        if (itemDoc.empty) {
          throw new Error(`Item ${itemId} not found`);
        }

        const item = { id: itemDoc.docs[0].id, ...itemDoc.docs[0].data() };

        // Index the item
        if (job.collection === 'products') {
          await indexProduct(item as Product);
        } else {
          await indexDeal(item as Deal);
        }

        successCount++;
      } catch (error) {
        logger.error('Failed to index item', { itemId, error });
        errors.push({
          itemId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }

      // Update progress
      await updateDoc(jobRef, {
        processedCount: successCount + failureCount,
        successCount,
        failureCount,
      });
    }

    // Mark job as completed
    const now = new Date();
    const startedAt = new Date(job.startedAt).getTime();
    const durationMs = now.getTime() - startedAt;

    await updateDoc(jobRef, {
      status: failureCount === 0 ? 'completed' : 'failed',
      finishedAt: Timestamp.fromDate(now),
      durationMs,
      errors: errors.length > 0 ? errors : undefined,
    });

    logger.info('Indexing job completed', {
      jobId,
      successCount,
      failureCount,
      durationMs,
    });
  } catch (error) {
    logger.error('Failed to process indexing job', { jobId, error });

    // Mark job as failed
    try {
      await updateDoc(doc(db, 'indexingJobs', jobId), {
        status: 'failed',
        finishedAt: Timestamp.now(),
      });
    } catch (updateError) {
      logger.error('Failed to update job status', { jobId, updateError });
    }

    throw error;
  }
}

/**
 * Batch index products
 */
export async function batchIndexProducts(
  productIds: string[],
  triggeredBy: IndexingJob['triggeredBy'] = 'manual',
  triggeredByUid?: string
): Promise<IndexingJob> {
  try {
    logger.info('Starting batch product indexing', { count: productIds.length });

    const job = await createIndexingJob(
      'products',
      'create',
      productIds,
      triggeredBy,
      triggeredByUid
    );

    // Process asynchronously (in production, this would be a Cloud Function trigger)
    processIndexingJob(job.id).catch(error => {
      logger.error('Async indexing job failed', { jobId: job.id, error });
    });

    return job;
  } catch (error) {
    logger.error('Failed to batch index products', { error });
    throw error;
  }
}

/**
 * Batch index deals
 */
export async function batchIndexDeals(
  dealIds: string[],
  triggeredBy: IndexingJob['triggeredBy'] = 'manual',
  triggeredByUid?: string
): Promise<IndexingJob> {
  try {
    logger.info('Starting batch deal indexing', { count: dealIds.length });

    const job = await createIndexingJob(
      'deals',
      'create',
      dealIds,
      triggeredBy,
      triggeredByUid
    );

    // Process asynchronously
    processIndexingJob(job.id).catch(error => {
      logger.error('Async indexing job failed', { jobId: job.id, error });
    });

    return job;
  } catch (error) {
    logger.error('Failed to batch index deals', { error });
    throw error;
  }
}

/**
 * Reindex all products
 */
export async function reindexAllProducts(
  triggeredByUid?: string
): Promise<IndexingJob> {
  try {
    logger.info('Starting full product reindex');

    // Get all approved products
    const productsSnapshot = await getDocs(
      query(collection(db, 'products'), where('status', '==', 'approved'))
    );

    const productIds = productsSnapshot.docs.map(doc => doc.id);

    return await batchIndexProducts(productIds, 'manual', triggeredByUid);
  } catch (error) {
    logger.error('Failed to reindex all products', { error });
    throw error;
  }
}

/**
 * Reindex all deals
 */
export async function reindexAllDeals(
  triggeredByUid?: string
): Promise<IndexingJob> {
  try {
    logger.info('Starting full deal reindex');

    // Get all approved deals
    const dealsSnapshot = await getDocs(
      query(collection(db, 'deals'), where('status', '==', 'approved'))
    );

    const dealIds = dealsSnapshot.docs.map(doc => doc.id);

    return await batchIndexDeals(dealIds, 'manual', triggeredByUid);
  } catch (error) {
    logger.error('Failed to reindex all deals', { error });
    throw error;
  }
}

/**
 * Get default search facets for products
 */
export function getProductSearchFacets(): SearchFacet[] {
  return [
    {
      field: 'mainCategorySlug',
      label: 'Kategoria główna',
      type: 'category',
      enabled: true,
      sortOrder: 1,
    },
    {
      field: 'subCategorySlug',
      label: 'Podkategoria',
      type: 'category',
      enabled: true,
      sortOrder: 2,
    },
    {
      field: 'priceRange',
      label: 'Przedział cenowy',
      type: 'range',
      enabled: true,
      sortOrder: 3,
      ranges: [
        { label: 'Do 50 zł', min: 0, max: 50 },
        { label: '50-100 zł', min: 50, max: 100 },
        { label: '100-200 zł', min: 100, max: 200 },
        { label: '200-500 zł', min: 200, max: 500 },
        { label: '500-1000 zł', min: 500, max: 1000 },
        { label: 'Powyżej 1000 zł', min: 1000, max: 999999 },
      ],
    },
    {
      field: 'ratingRange',
      label: 'Ocena',
      type: 'range',
      enabled: true,
      sortOrder: 4,
      values: ['4.5+', '4.0-4.5', '3.5-4.0', '3.0-3.5', '<3.0'],
    },
    {
      field: 'discountPercent',
      label: 'Zniżka',
      type: 'range',
      enabled: true,
      sortOrder: 5,
      ranges: [
        { label: 'Powyżej 50%', min: 50, max: 100 },
        { label: '30-50%', min: 30, max: 50 },
        { label: '10-30%', min: 10, max: 30 },
      ],
    },
  ];
}

/**
 * Get default search facets for deals
 */
export function getDealSearchFacets(): SearchFacet[] {
  return [
    {
      field: 'mainCategorySlug',
      label: 'Kategoria główna',
      type: 'category',
      enabled: true,
      sortOrder: 1,
    },
    {
      field: 'subCategorySlug',
      label: 'Podkategoria',
      type: 'category',
      enabled: true,
      sortOrder: 2,
    },
    {
      field: 'priceRange',
      label: 'Przedział cenowy',
      type: 'range',
      enabled: true,
      sortOrder: 3,
      ranges: [
        { label: 'Do 50 zł', min: 0, max: 50 },
        { label: '50-100 zł', min: 50, max: 100 },
        { label: '100-200 zł', min: 100, max: 200 },
        { label: '200-500 zł', min: 200, max: 500 },
        { label: 'Powyżej 500 zł', min: 500, max: 999999 },
      ],
    },
    {
      field: 'discountPercent',
      label: 'Zniżka',
      type: 'range',
      enabled: true,
      sortOrder: 4,
      ranges: [
        { label: 'Powyżej 70%', min: 70, max: 100 },
        { label: '50-70%', min: 50, max: 70 },
        { label: '30-50%', min: 30, max: 50 },
        { label: '10-30%', min: 10, max: 30 },
      ],
    },
    {
      field: 'merchant',
      label: 'Sprzedawca',
      type: 'multi_select',
      enabled: true,
      sortOrder: 5,
    },
  ];
}
