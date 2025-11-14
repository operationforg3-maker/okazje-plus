/**
 * Price Snapshot Engine
 * 
 * Core logic for capturing product price snapshots from various sources.
 * Supports dry-run mode for testing without database writes.
 * 
 * @module integrations/priceHistory/snapshotEngine
 */

import {
  PriceSnapshot,
  PriceHistoryRecord,
  SnapshotResult,
  createPriceSnapshot,
  upsertPriceHistoryRecord,
  getPriceHistoryRecord,
} from '@/lib/models/priceHistory';
import { createSnapshotLogger, logSnapshotStats, logError } from '@/lib/logger';
import { queueSnapshotForIndexing, updateProductPriceInSearch } from '@/search/queue';

/**
 * Source data for price snapshot
 * 
 * This is the input data format from external sources (scrapers, APIs, etc.)
 */
export interface SourcePriceData {
  /** Product ID in our system */
  productId: string;
  
  /** Current price */
  price: number;
  
  /** Currency code */
  currency?: string;
  
  /** Original price before discount */
  originalPrice?: number;
  
  /** Data source identifier */
  source: string;
  
  /** Whether product is in stock */
  inStock?: boolean;
  
  /** Merchant/seller info */
  merchant?: string;
  
  /** Shipping cost */
  shippingCost?: number;
  
  /** Raw data from source (for debugging) */
  rawData?: Record<string, any>;
}

/**
 * Options for snapshot operation
 */
export interface SnapshotOptions {
  /** Dry-run mode: don't write to database */
  dryRun?: boolean;
  
  /** Force snapshot even if price hasn't changed */
  force?: boolean;
  
  /** Skip indexing queue */
  skipIndexing?: boolean;
}

/**
 * Capture a price snapshot for a single product
 * 
 * This is the main entry point for capturing price data.
 * 
 * @param sourceData - Price data from external source
 * @param options - Snapshot operation options
 * @returns Promise resolving to operation result
 * 
 * @example
 * ```typescript
 * const result = await snapshotProductPrice({
 *   productId: 'prod_123',
 *   price: 99.99,
 *   currency: 'PLN',
 *   source: 'aliexpress',
 *   inStock: true,
 * }, { dryRun: true });
 * 
 * if (result.ok) {
 *   console.log(`Would create ${result.wouldCreate} snapshots`);
 * }
 * ```
 */
export async function snapshotProductPrice(
  sourceData: SourcePriceData,
  options: SnapshotOptions = {}
): Promise<SnapshotResult> {
  const operationId = `snapshot_${Date.now()}_${sourceData.productId}`;
  const logger = createSnapshotLogger(operationId);
  const startTime = Date.now();
  
  const {
    dryRun = false,
    force = false,
    skipIndexing = false,
  } = options;
  
  logger.info('Starting price snapshot', {
    productId: sourceData.productId,
    source: sourceData.source,
    dryRun,
    force,
  });
  
  const result: SnapshotResult = {
    ok: false,
    dryRun,
    wouldCreate: 0,
    wouldUpdate: 0,
    processed: 0,
    skipped: 0,
    errors: [],
  };
  
  try {
    // Validate input data
    if (!sourceData.productId || !sourceData.price || !sourceData.source) {
      throw new Error('Missing required fields: productId, price, source');
    }
    
    if (sourceData.price < 0) {
      throw new Error('Price cannot be negative');
    }
    
    // Get existing price history
    const existingHistory = await getPriceHistoryRecord(sourceData.productId);
    
    // Check if we should skip this snapshot
    if (!force && existingHistory) {
      const priceDiff = Math.abs(existingHistory.currentPrice - sourceData.price);
      const priceChangePercent = (priceDiff / existingHistory.currentPrice) * 100;
      
      // Skip if price hasn't changed significantly (less than 0.1%)
      if (priceChangePercent < 0.1) {
        logger.debug('Skipping snapshot - price unchanged', {
          productId: sourceData.productId,
          currentPrice: existingHistory.currentPrice,
          newPrice: sourceData.price,
          changePercent: priceChangePercent,
        });
        result.skipped = 1;
        result.ok = true;
        return result;
      }
    }
    
    // Calculate discount percentage
    const discountPercent = sourceData.originalPrice
      ? ((sourceData.originalPrice - sourceData.price) / sourceData.originalPrice) * 100
      : undefined;
    
    // Prepare snapshot data
    const snapshot: Omit<PriceSnapshot, 'id'> = {
      productId: sourceData.productId,
      price: sourceData.price,
      currency: sourceData.currency || 'PLN',
      originalPrice: sourceData.originalPrice,
      discountPercent,
      capturedAt: new Date().toISOString(),
      source: sourceData.source,
      inStock: sourceData.inStock ?? true,
      merchant: sourceData.merchant,
      shippingCost: sourceData.shippingCost,
      rawData: sourceData.rawData,
    };
    
    if (dryRun) {
      // Dry-run: just log what would happen
      logger.info('Dry-run: would create snapshot', { snapshot });
      result.wouldCreate = 1;
    } else {
      // Create snapshot in Firestore
      const snapshotId = await createPriceSnapshot(snapshot);
      logger.info('Created price snapshot', { snapshotId, productId: sourceData.productId });
      result.wouldCreate = 1;
      
      // Queue for search indexing
      if (!skipIndexing) {
        await queueSnapshotForIndexing(snapshotId);
      }
    }
    
    // Update price history record
    const now = new Date().toISOString();
    const historyUpdate: Omit<PriceHistoryRecord, 'id'> = existingHistory
      ? {
          // Update existing record
          productId: sourceData.productId,
          currentPrice: sourceData.price,
          lowestPrice: Math.min(existingHistory.lowestPrice, sourceData.price),
          highestPrice: Math.max(existingHistory.highestPrice, sourceData.price),
          averagePrice: calculateNewAverage(
            existingHistory.averagePrice,
            existingHistory.snapshotCount,
            sourceData.price
          ),
          lowestPriceDate: sourceData.price < existingHistory.lowestPrice 
            ? now 
            : existingHistory.lowestPriceDate,
          highestPriceDate: sourceData.price > existingHistory.highestPrice 
            ? now 
            : existingHistory.highestPriceDate,
          snapshotCount: existingHistory.snapshotCount + 1,
          firstCapturedAt: existingHistory.firstCapturedAt,
          lastUpdatedAt: now,
          trend: determineTrend(existingHistory.currentPrice, sourceData.price),
          changePercent: calculateChangePercent(existingHistory.currentPrice, sourceData.price),
        }
      : {
          // Create new record
          productId: sourceData.productId,
          currentPrice: sourceData.price,
          lowestPrice: sourceData.price,
          highestPrice: sourceData.price,
          averagePrice: sourceData.price,
          lowestPriceDate: now,
          highestPriceDate: now,
          snapshotCount: 1,
          firstCapturedAt: now,
          lastUpdatedAt: now,
          trend: 'stable',
          changePercent: 0,
        };
    
    if (dryRun) {
      logger.info('Dry-run: would update history', { historyUpdate });
      result.wouldUpdate = 1;
    } else {
      await upsertPriceHistoryRecord(historyUpdate);
      logger.info('Updated price history', { productId: sourceData.productId });
      result.wouldUpdate = 1;
      
      // Update search index
      if (!skipIndexing) {
        await updateProductPriceInSearch(sourceData.productId);
      }
    }
    
    result.processed = 1;
    result.ok = true;
    
  } catch (error) {
    logError(logger, error, { productId: sourceData.productId });
    result.errors.push({
      productId: sourceData.productId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    result.durationMs = Date.now() - startTime;
    
    logSnapshotStats(logger, {
      processed: result.processed,
      created: result.wouldCreate,
      updated: result.wouldUpdate,
      skipped: result.skipped,
      errors: result.errors.length,
      durationMs: result.durationMs,
    });
  }
  
  return result;
}

/**
 * Batch snapshot operation for multiple products
 * 
 * @param sourcesData - Array of price data from external sources
 * @param options - Snapshot operation options
 * @returns Promise resolving to aggregated result
 */
export async function snapshotProductPrices(
  sourcesData: SourcePriceData[],
  options: SnapshotOptions = {}
): Promise<SnapshotResult> {
  const operationId = `batch_snapshot_${Date.now()}`;
  const logger = createSnapshotLogger(operationId);
  const startTime = Date.now();
  
  logger.info('Starting batch snapshot operation', {
    count: sourcesData.length,
    dryRun: options.dryRun,
  });
  
  const aggregatedResult: SnapshotResult = {
    ok: true,
    dryRun: options.dryRun ?? false,
    wouldCreate: 0,
    wouldUpdate: 0,
    processed: 0,
    skipped: 0,
    errors: [],
  };
  
  // Process snapshots sequentially to avoid overwhelming Firestore
  // TODO M6: Consider parallel processing with rate limiting
  for (const sourceData of sourcesData) {
    const result = await snapshotProductPrice(sourceData, options);
    
    aggregatedResult.wouldCreate += result.wouldCreate;
    aggregatedResult.wouldUpdate += result.wouldUpdate;
    aggregatedResult.processed += result.processed;
    aggregatedResult.skipped += result.skipped;
    aggregatedResult.errors.push(...result.errors);
    
    if (!result.ok) {
      aggregatedResult.ok = false;
    }
  }
  
  aggregatedResult.durationMs = Date.now() - startTime;
  
  logSnapshotStats(logger, {
    processed: aggregatedResult.processed,
    created: aggregatedResult.wouldCreate,
    updated: aggregatedResult.wouldUpdate,
    skipped: aggregatedResult.skipped,
    errors: aggregatedResult.errors.length,
    durationMs: aggregatedResult.durationMs,
  });
  
  return aggregatedResult;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate new average price
 */
function calculateNewAverage(
  currentAvg: number,
  count: number,
  newPrice: number
): number {
  return (currentAvg * count + newPrice) / (count + 1);
}

/**
 * Determine price trend
 */
function determineTrend(
  oldPrice: number,
  newPrice: number
): 'up' | 'down' | 'stable' {
  const diff = newPrice - oldPrice;
  const changePercent = Math.abs(diff / oldPrice) * 100;
  
  // Consider stable if change is less than 0.5%
  if (changePercent < 0.5) {
    return 'stable';
  }
  
  return diff > 0 ? 'up' : 'down';
}

/**
 * Calculate percentage change
 */
function calculateChangePercent(oldPrice: number, newPrice: number): number {
  return ((newPrice - oldPrice) / oldPrice) * 100;
}
