/**
 * Firebase Cloud Function: Telegram Hot Deal Broadcaster
 * 
 * Trigger: onDocumentUpdated for deals collection
 * 
 * Broadcasts when:
 * 1. Deal status changes to 'approved' (new deal published)
 * 2. Temperature rises above 100 (deal is getting hot!)
 * 3. Not already notified (notified flag)
 */

import * as logger from 'firebase-functions/logger';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { broadcastHotDeal } from '../../../src-legacy/integrations/telegram';

interface Deal {
  id: string;
  title: string;
  description?: string;
  price: number;
  originalPrice?: number;
  temperature: number;
  status: 'draft' | 'approved' | 'rejected';
  link: string;
  image?: string;
  notified?: boolean;
  notifiedAt?: string;
}

/**
 * Firebase Function: Broadcast hot deals to Telegram
 * 
 * Checks if deal qualifies for notification:
 * - Status is 'approved' (published)
 * - Temperature >= 100 (hot!)
 * - Not already notified
 */
// V2 suffix to avoid HTTPS->background rename conflict with legacy deployment
export const telegramHotDealBroadcasterV2 = onDocumentUpdated(
  {
    document: 'deals/{dealId}',
    region: 'europe-west1',
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const dealId = event.params.dealId;
    const before = change.before.data() as Deal;
    const after = change.after.data() as Deal;

    try {
      logger.info(`[Telegram] Deal updated: ${dealId}`, {
        statusBefore: before.status,
        statusAfter: after.status,
        tempBefore: before.temperature,
        tempAfter: after.temperature,
        notified: after.notified,
      });

      // Skip if already notified
      if (after.notified) {
        logger.info(`[Telegram] Already notified for ${dealId}, skipping`);
        return;
      }

      // Condition 1: Deal was approved (new deal published)
      if (before.status !== 'approved' && after.status === 'approved') {
        logger.info(`[Telegram] Deal approved: ${dealId}, broadcasting`);

        const result = await broadcastHotDeal({
          ...after,
          id: dealId,
        });

        if (result) {
          await change.after.ref.update({
            notified: true,
            notifiedAt: new Date().toISOString(),
          });
          logger.info(`[Telegram] ✓ Notified for new approved deal: ${dealId}`);
        }

        return;
      }

      // Condition 2: Temperature crossed 100 threshold
      if (before.temperature < 100 && after.temperature >= 100) {
        logger.info(
          `[Telegram] Deal got hot! ${dealId}: ${before.temperature}° → ${after.temperature}°`
        );

        const result = await broadcastHotDeal({
          ...after,
          id: dealId,
        });

        if (result) {
          await change.after.ref.update({
            notified: true,
            notifiedAt: new Date().toISOString(),
          });
          logger.info(`[Telegram] ✓ Sent hot deal notification: ${dealId}`);
        }

        return;
      }

      logger.info(
        `[Telegram] Deal doesn't qualify for notification: ${dealId}`
      );
    } catch (error: any) {
      logger.error(
        `[Telegram] Failed to process deal ${dealId}:`,
        error.message
      );
      // Don't throw - we don't want to fail the deal update
    }
  }
);
