/**
 * Firebase Cloud Function: Auto-fill Draft Deals
 * 
 * Trigger: onDocumentCreated in 'draft_deals' collection
 * 
 * Workflow:
 * 1. Scrape product link using cheerio
 * 2. Extract basic content (title, description, image, price)
 * 3. Send to Gemini for AI enhancement
 * 4. Generate complete deal content
 * 5. Create 'deals' document with status='draft'
 * 6. Update draft_deal with processing status
 */

import * as logger from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { scrapeProductLink } from '../ai/flows/draftDealFiller/scrapeProduct';
import { generateDealContent, contentToDeal } from '../ai/flows/draftDealFiller/generateContent';

const db = getFirestore();

interface DraftDeal {
  id: string;
  link: string;
  userId: string;
  createdAt: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  dealId?: string;
}

/**
 * Firebase Function: Auto-fill draft deals
 * Triggers when user adds new draft_deal document
 */
// V2 suffix to avoid HTTPS->background rename conflict with legacy deployment
export const autofillDraftDealV2 = onDocumentCreated(
  {
    document: 'draft_deals/{draftDealId}',
    region: 'europe-west1',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const draftDealId = event.params.draftDealId;
    const draftDeal = snapshot.data() as DraftDeal;

    try {
      logger.info(`[AutoFill] Starting auto-fill for draft: ${draftDealId}`, {
        link: draftDeal.link,
        userId: draftDeal.userId,
      });

      // Update status to processing
      await snapshot.ref.update({
        status: 'processing',
        processedAt: new Date().toISOString(),
      });

      // Step 1: Scrape product link
      logger.info(`[AutoFill] Scraping: ${draftDeal.link}`);
      const scraped = await scrapeProductLink(draftDeal.link);

      if (!scraped) {
        throw new Error('Failed to scrape product link');
      }

      logger.info(`[AutoFill] ✓ Scraped: ${scraped.title}`);

      // Step 2: Generate content with Gemini
      logger.info(`[AutoFill] Generating AI content...`);
      const generated = await generateDealContent({
        title: scraped.title,
        description: scraped.description,
        originalUrl: scraped.originalUrl,
        imageUrl: scraped.imageUrl,
        price: scraped.price,
        htmlContent: scraped.htmlContent,
      });

      logger.info(`[AutoFill] ✓ Generated with confidence: ${generated.confidence}`);

      if (generated.warnings.length > 0) {
        logger.warn('[AutoFill] Warnings:', generated.warnings);
      }

      // Step 3: Create deal document
      const dealData = contentToDeal(
        {
          title: scraped.title,
          description: scraped.description,
          originalUrl: scraped.originalUrl,
          imageUrl: scraped.imageUrl,
          price: scraped.price,
          htmlContent: scraped.htmlContent,
        },
        generated,
        draftDealId,
        draftDeal.userId
      );

      // Add to deals collection with ready_for_review status
      const dealRef = db.collection('deals').doc();
      await dealRef.set(dealData);

      logger.info(`[AutoFill] ✓ Created deal: ${dealRef.id}`);

      // Step 4: Update draft_deal with success
      await snapshot.ref.update({
        status: 'completed',
        dealId: dealRef.id,
        completedAt: new Date().toISOString(),
        error: null,
      });

      logger.info(
        `[AutoFill] ✅ Successfully auto-filled draft ${draftDealId} → deal ${dealRef.id}`
      );

      return {
        success: true,
        draftDealId,
        dealId: dealRef.id,
      };
    } catch (error: any) {
      logger.error(`[AutoFill] Failed to auto-fill draft ${draftDealId}:`, error);

      // Update draft_deal with error status
      try {
        await snapshot.ref.update({
          status: 'failed',
          error: error.message || 'Unknown error',
          failedAt: new Date().toISOString(),
        });
      } catch (updateError) {
        logger.error(`[AutoFill] Failed to update draft_deal status:`, updateError);
      }

      // Don't throw - we don't want to fail the function
      return {
        success: false,
        draftDealId,
        error: error.message,
      };
    }
  }
);
