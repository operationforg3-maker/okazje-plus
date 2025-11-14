/**
 * Price Snapshot Scheduler
 * 
 * Wrapper for scheduling price snapshot operations.
 * This module provides functions that will be called by Firebase scheduled functions.
 * 
 * @module integrations/priceHistory/scheduler
 */

import { snapshotProductPrices, SourcePriceData } from './snapshotEngine';
import { isPriceMonitoringEnabled, isPriceMonitoringDryRun } from '@/lib/featureFlags';
import { m6Logger } from '@/lib/logger';

/**
 * Result from scheduled snapshot run
 */
export interface ScheduledSnapshotResult {
  /** Whether run was successful */
  success: boolean;
  
  /** Number of products processed */
  productsProcessed: number;
  
  /** Number of snapshots created */
  snapshotsCreated: number;
  
  /** Number of errors */
  errorCount: number;
  
  /** Run duration in milliseconds */
  durationMs: number;
  
  /** Whether this was a dry-run */
  dryRun: boolean;
  
  /** When run started */
  startedAt: string;
  
  /** When run completed */
  completedAt: string;
}

/**
 * Execute scheduled price snapshot run
 * 
 * This is called by the Firebase scheduled function (see functions/priceHistorySync.ts).
 * It checks feature flags, loads products to monitor, and captures snapshots.
 * 
 * @returns Promise resolving to run result
 * 
 * @example
 * ```typescript
 * // In Firebase Function
 * export const scheduledPriceSnapshot = onSchedule({
 *   schedule: 'every 24 hours',
 *   region: 'europe-west1',
 * }, async (event) => {
 *   const result = await runScheduledSnapshot();
 *   return result;
 * });
 * ```
 */
export async function runScheduledSnapshot(): Promise<ScheduledSnapshotResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  
  const logger = m6Logger.child({ operation: 'scheduled_snapshot' });
  
  logger.info('Starting scheduled price snapshot run');
  
  // Check if feature is enabled
  const isEnabled = await isPriceMonitoringEnabled();
  if (!isEnabled) {
    logger.warn('Price monitoring is disabled - skipping run');
    return {
      success: true,
      productsProcessed: 0,
      snapshotsCreated: 0,
      errorCount: 0,
      durationMs: Date.now() - startTime,
      dryRun: false,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
  
  // Check if dry-run mode
  const dryRun = await isPriceMonitoringDryRun();
  if (dryRun) {
    logger.info('Running in DRY-RUN mode - no database writes');
  }
  
  try {
    // TODO M6: Load products to monitor from Firestore
    // For now, use stub data
    const productsToMonitor = await loadProductsForMonitoring();
    
    logger.info(`Loaded ${productsToMonitor.length} products to monitor`);
    
    if (productsToMonitor.length === 0) {
      logger.warn('No products to monitor');
      return {
        success: true,
        productsProcessed: 0,
        snapshotsCreated: 0,
        errorCount: 0,
        durationMs: Date.now() - startTime,
        dryRun,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
    
    // Capture snapshots
    const result = await snapshotProductPrices(productsToMonitor, { dryRun });
    
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;
    
    logger.info('Scheduled snapshot run completed', {
      success: result.ok,
      productsProcessed: result.processed,
      snapshotsCreated: result.wouldCreate,
      errorCount: result.errors.length,
      durationMs,
    });
    
    return {
      success: result.ok,
      productsProcessed: result.processed,
      snapshotsCreated: result.wouldCreate,
      errorCount: result.errors.length,
      durationMs,
      dryRun,
      startedAt,
      completedAt,
    };
    
  } catch (error) {
    logger.error('Scheduled snapshot run failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return {
      success: false,
      productsProcessed: 0,
      snapshotsCreated: 0,
      errorCount: 1,
      durationMs: Date.now() - startTime,
      dryRun,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

/**
 * Load products that should be monitored
 * 
 * @returns Promise resolving to array of source price data
 * 
 * TODO M6: Implement actual Firestore query to load products
 * Should consider:
 * - Products with status = 'approved'
 * - Products not in exclusion list
 * - Products with affiliate URLs (for price fetching)
 * - Pagination/batching for large datasets
 */
async function loadProductsForMonitoring(): Promise<SourcePriceData[]> {
  // TODO M6: Implement Firestore query
  // const db = getFirestore();
  // const q = query(
  //   collection(db, 'products'),
  //   where('status', '==', 'approved'),
  //   where('affiliateUrl', '!=', null),
  //   limit(100) // Process in batches
  // );
  // const snapshot = await getDocs(q);
  // 
  // return snapshot.docs.map(doc => {
  //   const product = doc.data();
  //   return {
  //     productId: doc.id,
  //     price: product.price,
  //     currency: 'PLN',
  //     originalPrice: product.originalPrice,
  //     source: 'manual', // Or determine from product metadata
  //     inStock: true,
  //   };
  // });
  
  // Stub: return empty array
  console.log('[STUB] loadProductsForMonitoring - returning empty array');
  return [];
}

/**
 * Manual trigger for price snapshot (for admin use)
 * 
 * Allows admins to manually trigger price snapshots for specific products.
 * 
 * @param productIds - Array of product IDs to snapshot
 * @param dryRun - Whether to run in dry-run mode
 * @returns Promise resolving to run result
 */
export async function triggerManualSnapshot(
  productIds: string[],
  dryRun = false
): Promise<ScheduledSnapshotResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  
  const logger = m6Logger.child({ 
    operation: 'manual_snapshot',
    productIds,
  });
  
  logger.info('Starting manual price snapshot', {
    count: productIds.length,
    dryRun,
  });
  
  try {
    // TODO M6: Load specific products by IDs
    const productsData: SourcePriceData[] = []; // Stub
    
    // Capture snapshots
    const result = await snapshotProductPrices(productsData, { 
      dryRun,
      force: true, // Force snapshot even if price unchanged
    });
    
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;
    
    logger.info('Manual snapshot completed', {
      success: result.ok,
      productsProcessed: result.processed,
      snapshotsCreated: result.wouldCreate,
      errorCount: result.errors.length,
      durationMs,
    });
    
    return {
      success: result.ok,
      productsProcessed: result.processed,
      snapshotsCreated: result.wouldCreate,
      errorCount: result.errors.length,
      durationMs,
      dryRun,
      startedAt,
      completedAt,
    };
    
  } catch (error) {
    logger.error('Manual snapshot failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return {
      success: false,
      productsProcessed: 0,
      snapshotsCreated: 0,
      errorCount: 1,
      durationMs: Date.now() - startTime,
      dryRun,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}
