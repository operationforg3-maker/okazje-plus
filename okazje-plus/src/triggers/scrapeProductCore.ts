/**
 * Firebase Cloud Function: Async AliExpress Product Scraper
 *
 * Trigger: Firestore onDocumentCreated('product_cores/{productId}')
 * Guard:   metadata.source === 'aliexpress' && scrapingStatus === 'pending'
 *
 * Workflow:
 * 1. Guard: tylko aliexpress + pending
 * 2. Mark scrapingStatus → 'running', increment scrapingAttempts
 * 3. scrapeAliExpressProduct() — Puppeteer via @sparticuz/chromium
 * 4. Merge specs (API priority), write reviewImages/descriptionImages/descriptionHtml
 * 5. Mark scrapingStatus → 'done' z pełną metadatą
 * 6. On error: reset → 'pending' (Cloud Fn auto-retry, max 3x), po 3x → 'failed'
 */

import * as logger from 'firebase-functions/logger';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { scrapeAliExpressProduct } from '../lib/aliexpress/scraper';

const SCRAPER_VERSION = '2.0';
const MAX_RETRIES = 3;

export const scrapeProductCore = onDocumentCreated(
  {
    document: 'product_cores/{productId}',
    region: 'europe-west4',
    timeoutSeconds: 180,
    memory: '2GiB',
    concurrency: 3,
    maxInstances: 5,
    retry: true,
  },
  async (event) => {
    const db = getFirestore();
    const data = event.data?.data();
    const productId = event.params.productId;

    // ─── Guard ─────────────────────────────────────────────────────────────
    if (data?.metadata?.source !== 'aliexpress') return;
    if (data?.scrapingStatus !== 'pending') return;

    const aliExpressId = String(data?.metadata?.originalId || '');
    if (!aliExpressId) {
      logger.warn(`[ScrapeProduct] No originalId for productId=${productId}`);
      return;
    }

    const docRef = db.collection('product_cores').doc(productId);
    const attempt = (data?.scrapingMetadata?.scrapingAttempts || 0) + 1;

    logger.info(`[ScrapeProduct] Attempt ${attempt}/${MAX_RETRIES} for productId=${productId} aliId=${aliExpressId}`);

    // Mark as running
    await docRef.update({
      scrapingStatus: 'running',
      'scrapingMetadata.scrapingAttempts': attempt,
    });

    try {
      const scraped = await scrapeAliExpressProduct(aliExpressId);

      // Merge specs: existing API specs have higher priority than scraped
      const existingSpecs = data?.specs || {};
      const mergedSpecs: Record<string, string> = {
        ...scraped.specs,   // scraped (niższy priorytet)
        ...existingSpecs,   // API (wyższy priorytet)
      };

      const updatePayload: Record<string, any> = {
        specs: mergedSpecs,
        scrapingStatus: 'done',
        'scrapingMetadata.scrapedAt': new Date().toISOString(),
        'scrapingMetadata.scrapingVersion': SCRAPER_VERSION,
        'scrapingMetadata.captchaEncountered': false,
        'scrapingMetadata.reviewsCount': scraped.reviewImages?.length || 0,
        'scrapingMetadata.lastError': FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      };

      // Dedykowane pola ze scrapera (tylko jeśli nie puste)
      if (scraped.reviewImages?.length) {
        updatePayload.reviewImages = scraped.reviewImages;
      }
      if (scraped.descriptionImages?.length) {
        updatePayload.descriptionImages = scraped.descriptionImages;
      }
      if (scraped.descriptionHtml) {
        // Zapisz HTML opisu do fullDescription.pl (lokalizacja PL)
        updatePayload['fullDescription.pl'] = scraped.descriptionHtml;
      }

      await docRef.update(updatePayload);

      logger.info(
        `[ScrapeProduct] ✅ Done for ${productId}: ` +
        `reviewImages=${scraped.reviewImages?.length || 0}, ` +
        `descImages=${scraped.descriptionImages?.length || 0}`
      );

    } catch (err: any) {
      const isLastAttempt = attempt >= MAX_RETRIES;
      const isCaptcha = /captcha|blocked|403|429|forbidden/i.test(err.message || '');

      logger.error(
        `[ScrapeProduct] Attempt ${attempt} FAILED for ${productId}: ${err.message}`,
        { isLastAttempt, isCaptcha }
      );

      await docRef.update({
        // Jeśli nie ostatnia próba: reset do 'pending' żeby Cloud Fn ponowił
        // Jeśli ostatnia próba: 'failed' — admin musi ręcznie retry
        scrapingStatus: isLastAttempt ? 'failed' : 'pending',
        'scrapingMetadata.lastError': (err.message || 'Unknown error').slice(0, 200),
        'scrapingMetadata.captchaEncountered': isCaptcha,
      });

      if (!isLastAttempt) {
        // Throw → Cloud Functions zaplanuje retry z exponential backoff
        // (~1min, 5min, 15min)
        throw err;
      }

      logger.error(`[ScrapeProduct] ❌ All ${MAX_RETRIES} attempts failed for ${productId}`);
    }
  }
);
