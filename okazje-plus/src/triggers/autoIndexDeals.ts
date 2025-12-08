/**
 * Firebase Cloud Function: Auto-index new deals in Google Search
 * 
 * Triggers on new document creation in 'deals' collection.
 * Automatically submits the deal URL to Google Indexing API.
 */

import * as logger from 'firebase-functions/logger';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { requestDealIndexing } from '../../../src/lib/google-indexing';
import type { Deal } from '../../../src/lib/types';

/**
 * Firestore trigger: onCreate for deals collection
 * 
 * When a new deal is created, automatically request Google to index it.
 */
export const autoIndexNewDealV2 = onDocumentCreated({
  document: 'deals/{dealId}',
  region: 'europe-west1',
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  
  const dealId = event.params.dealId;
  const deal = snapshot.data() as Deal;

    try {
      logger.info(`[AutoIndex] New deal created: ${dealId}`, {
        id: deal.id,
        status: deal.status,
      });

      // Only index approved deals
      if (deal.status !== 'approved') {
        logger.info(`[AutoIndex] Skipping - deal not approved (status: ${deal.status})`);
        return null;
      }

      // Request indexing using deal ID
      const result = await requestDealIndexing(dealId, 'URL_UPDATED');

      if (result.success) {
        logger.info(`[AutoIndex] ✓ Successfully requested indexing for: ${dealId}`);
        
        // Update deal document with indexing metadata
        await snapshot.ref.update({
          'seo.indexedAt': new Date().toISOString(),
          'seo.indexingRequested': true,
        });
      } else {
        logger.error(`[AutoIndex] ✗ Failed to request indexing: ${result.error}`);
        
        // Log error but don't fail the function
        await snapshot.ref.update({
          'seo.indexingError': result.error,
          'seo.indexingRequested': false,
        });
      }

      return result;
    } catch (error: any) {
      logger.error(`[AutoIndex] Error processing deal ${dealId}:`, error);
      
      // Don't throw - we don't want to fail the deal creation
      return null;
    }
});

/**
 * Firestore trigger: onUpdate for deals collection
 * 
 * Re-index when deal status changes to 'approved'
 */
// V2 suffix to avoid HTTPS->background rename conflict with legacy deployment
export const reIndexOnApprovalV2 = onDocumentUpdated({
  document: 'deals/{dealId}',
  region: 'europe-west1',
}, async (event) => {
  const change = event.data;
  if (!change) return;
  
  const dealId = event.params.dealId;
  const before = change.before.data() as Deal;
  const after = change.after.data() as Deal;

    try {
      // Check if status changed to approved
      if (before.status !== 'approved' && after.status === 'approved') {
        logger.info(`[AutoIndex] Deal approved: ${dealId}, requesting indexing`);

        const result = await requestDealIndexing(dealId, 'URL_UPDATED');

        if (result.success) {
          logger.info(`[AutoIndex] ✓ Successfully requested indexing for approved deal: ${dealId}`);
          
          await change.after.ref.update({
            'seo.indexedAt': new Date().toISOString(),
            'seo.indexingRequested': true,
          });
        } else {
          logger.error(`[AutoIndex] ✗ Failed to request indexing: ${result.error}`);
        }

        return result;
      }

      // Check if status changed to rejected - request removal
      if (before.status === 'approved' && after.status === 'rejected') {
        logger.info(`[AutoIndex] Deal ${after.status}: ${dealId}, requesting removal from index`);

        const result = await requestDealIndexing(dealId, 'URL_DELETED');

        if (result.success) {
          logger.info(`[AutoIndex] ✓ Successfully requested removal: ${dealId}`);
        }

        return result;
      }

      return null;
    } catch (error: any) {
      logger.error(`[AutoIndex] Error on update for deal ${dealId}:`, error);
      return null;
    }
});
