/**
 * Scheduled Price Update Cloud Function
 * 
 * Updates all deal prices daily at 3:00 AM (Europe/Warsaw)
 * Uses stored originalPriceUSD and current NBP exchange rates
 * 
 * This ensures prices stay current even when exchange rates change
 * Solves the issue of stale prices after import
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, writeBatch } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

// Type definitions
interface NBPExchangeRate {
  currency: string;
  code: string;
  mid: number;
}

interface NBPResponse {
  table: string;
  no: string;
  effectiveDate: string;
  rates: NBPExchangeRate[];
}

interface DealMetadata {
  originalPriceUSD?: number;
  originalPriceCurrency?: string;
  exchangeRateAtImport?: number;
  lastPriceUpdate?: string;
}

/**
 * Fetch current USD/PLN exchange rate from NBP API
 */
async function getUSDtoPLNRate(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.nbp.pl/api/exchangerates/rates/a/USD/?format=json'
    );

    if (!response.ok) {
      throw new Error(`NBP API error: ${response.status}`);
    }

    const data = (await response.json()) as NBPResponse;
    const rate = data.rates[0].mid;

    logger.info(`[NBP] Fetched USD/PLN rate: ${rate}`);
    return rate;
  } catch (error) {
    logger.error('[NBP] Failed to fetch exchange rate:', error);
    // Fallback rate (updated manually as backup)
    logger.warn('[NBP] Using fallback rate: 4.0');
    return 4.0;
  }
}

/**
 * Cloud Function: Daily price update
 * Scheduled to run every day at 3:00 AM (Europe/Warsaw)
 * 
 * Process:
 * 1. Fetch current USD/PLN rate from NBP
 * 2. Query all deals with originalPriceUSD set
 * 3. Recalculate prices using current exchange rate
 * 4. Update in batches (max 500 docs per batch)
 * 5. Log results
 */
export const updatePricesDaily = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'Europe/Warsaw',
    region: 'europe-west1',
  },
  async (event) => {
    const db = getFirestore();
    const startTime = Date.now();

    try {
      logger.info('[Price Update] Starting daily price update...');

      // Step 1: Fetch current exchange rate
      const currentRate = await getUSDtoPLNRate();
      logger.info(`[Price Update] Current USD/PLN rate: ${currentRate}`);

      // Step 2: Query all deals with originalPriceUSD
      const dealsSnapshot = await db
        .collection('deals')
        .where('metadata.originalPriceUSD', '>', 0)
        .get();

      logger.info(
        `[Price Update] Found ${dealsSnapshot.docs.length} deals to update`
      );

      if (dealsSnapshot.empty) {
        logger.info('[Price Update] No deals to update');
        return {
          success: true,
          updated: 0,
          duration: Date.now() - startTime,
          rate: currentRate,
        };
      }

      // Step 3: Process updates in batches
      const batch = writeBatch(db);
      let updateCount = 0;
      const maxBatchSize = 500;
      let batchOps = 0;

      const now = new Date().toISOString();

      for (const doc of dealsSnapshot.docs) {
        const data = doc.data();
        const metadata = (data.metadata || {}) as DealMetadata;
        const originalUSD = metadata.originalPriceUSD;

        if (!originalUSD || originalUSD <= 0) {
          logger.debug(`[Price Update] Skipping deal ${doc.id}: no originalPriceUSD`);
          continue;
        }

        // Calculate new price in PLN
        const newPricePLN = Math.round(originalUSD * currentRate * 100) / 100;
        const totalPrice = newPricePLN + (data.shippingCost || 0);

        // Update batch
        batch.update(doc.ref, {
          price: newPricePLN,
          totalPrice: totalPrice,
          'metadata.exchangeRateAtImport': currentRate,
          'metadata.lastPriceUpdate': now,
          updatedAt: now,
        });

        batchOps++;
        updateCount++;

        // Commit batch when it reaches max size
        if (batchOps >= maxBatchSize) {
          await batch.commit();
          logger.info(
            `[Price Update] Committed batch of ${batchOps} operations`
          );
          batchOps = 0;
        }
      }

      // Commit remaining operations
      if (batchOps > 0) {
        await batch.commit();
        logger.info(
          `[Price Update] Committed final batch of ${batchOps} operations`
        );
      }

      const duration = Date.now() - startTime;
      logger.info(
        `[Price Update] Successfully updated ${updateCount} deals in ${duration}ms`
      );

      return {
        success: true,
        updated: updateCount,
        duration: duration,
        rate: currentRate,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('[Price Update] Failed:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: duration,
      };
    }
  }
);

/**
 * Manual Price Update Callable Function
 * For testing or manual triggers from admin panel
 * 
 * Usage:
 * ```typescript
 * const functions = getFunctions();
 * const updatePrices = httpsCallable(functions, 'manualPriceUpdate');
 * const result = await updatePrices({});
 * ```
 */
export const manualPriceUpdate = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const db = getFirestore();

    // Check if user is admin (optional - can be removed for debugging)
    // const uid = request.auth?.uid;
    // if (!uid) throw new HttpsError('unauthenticated', 'User not authenticated');

    try {
      logger.info('[Manual Price Update] Triggered by user');

      // Fetch current rate
      const currentRate = await getUSDtoPLNRate();
      logger.info(
        `[Manual Price Update] Current USD/PLN rate: ${currentRate}`
      );

      // Query and update (same logic as scheduled function)
      const dealsSnapshot = await db
        .collection('deals')
        .where('metadata.originalPriceUSD', '>', 0)
        .get();

      const batch = writeBatch(db);
      let updateCount = 0;
      const now = new Date().toISOString();

      for (const doc of dealsSnapshot.docs) {
        const data = doc.data();
        const metadata = (data.metadata || {}) as DealMetadata;
        const originalUSD = metadata.originalPriceUSD;

        if (!originalUSD || originalUSD <= 0) continue;

        const newPricePLN = Math.round(originalUSD * currentRate * 100) / 100;
        const totalPrice = newPricePLN + (data.shippingCost || 0);

        batch.update(doc.ref, {
          price: newPricePLN,
          totalPrice: totalPrice,
          'metadata.exchangeRateAtImport': currentRate,
          'metadata.lastPriceUpdate': now,
          updatedAt: now,
        });

        updateCount++;
      }

      await batch.commit();

      logger.info(
        `[Manual Price Update] Updated ${updateCount} deals`
      );

      return {
        success: true,
        updated: updateCount,
        rate: currentRate,
      };
    } catch (error) {
      logger.error('[Manual Price Update] Failed:', error);
      throw error;
    }
  }
);

// Import for callable function
import { onCall } from 'firebase-functions/v2/https';
