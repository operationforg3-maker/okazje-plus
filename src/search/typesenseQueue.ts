/**
 * Typesense indexing queue.
 *
 * Writes indexing jobs to Firestore so background workers/cron can process them.
 */

import { logger } from '@/lib/logging';
import { adminDb } from '@/lib/firebase-admin';

type QueueEntity = 'products' | 'deals';
type QueueOperation = 'upsert' | 'delete';

const COLLECTION_NAME = 'typesense_index_queue';

async function enqueue(entity: QueueEntity, operation: QueueOperation, itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;

  const now = new Date().toISOString();
  const uniqueIds = Array.from(new Set(itemIds));

  const batch = adminDb.batch();
  for (const itemId of uniqueIds) {
    const docId = `${entity}_${operation}_${itemId}`;
    const ref = adminDb.collection(COLLECTION_NAME).doc(docId);
    batch.set(
      ref,
      {
        entity,
        operation,
        itemId,
        status: 'pending',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await batch.commit();
  logger.info('Queued Typesense indexing tasks', { entity, operation, count: uniqueIds.length });
}

/**
 * Queue a product for Typesense indexing
 * 
 * @param productId - Firestore document ID of the product
 * @returns Promise that resolves when queued (stub returns immediately)
 * 
 * TODO M2: Replace with actual queue implementation
 */
export async function queueProductForIndexing(productId: string): Promise<void> {
  await enqueue('products', 'upsert', [productId]);
}

/**
 * Queue a deal for Typesense indexing
 * 
 * @param dealId - Firestore document ID of the deal
 * @returns Promise that resolves when queued (stub returns immediately)
 * 
 * TODO M2: Replace with actual queue implementation
 */
export async function queueDealForIndexing(dealId: string): Promise<void> {
  await enqueue('deals', 'upsert', [dealId]);
}

/**
 * Queue multiple products for batch indexing
 * 
 * @param productIds - Array of product IDs to index
 * @returns Promise that resolves when all queued
 * 
 * TODO M2: Implement batch indexing
 */
export async function queueProductsForIndexing(productIds: string[]): Promise<void> {
  await enqueue('products', 'upsert', productIds);
}

/**
 * Queue multiple deals for batch indexing
 * 
 * @param dealIds - Array of deal IDs to index
 * @returns Promise that resolves when all queued
 * 
 * TODO M2: Implement batch indexing
 */
export async function queueDealsForIndexing(dealIds: string[]): Promise<void> {
  await enqueue('deals', 'upsert', dealIds);
}

/**
 * Remove a product from Typesense index
 * 
 * @param productId - Product ID to remove
 * @returns Promise that resolves when removed
 * 
 * TODO M2: Implement actual removal logic
 */
export async function removeProductFromIndex(productId: string): Promise<void> {
  await enqueue('products', 'delete', [productId]);
}

/**
 * Remove a deal from Typesense index
 * 
 * @param dealId - Deal ID to remove
 * @returns Promise that resolves when removed
 * 
 * TODO M2: Implement actual removal logic
 */
export async function removeDealFromIndex(dealId: string): Promise<void> {
  await enqueue('deals', 'delete', [dealId]);
}
