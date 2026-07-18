/**
 * SEO Zombie Cleaner - Cron Job
 * 
 * Scheduled function (daily 3am Europe/Warsaw)
 * 
 * Marks expired deals and creates internal links to similar active deals
 * Workflow:
 * 1. Find expired deals (expiresAt < now OR no activity 30 days)
 * 2. Change status to 'expired'
 * 3. Request URL_DELETED from Google Indexing API
 * 4. Use Gemini to find 3 similar active deals
 * 5. Set relatedDeals field for internal linking
 */

import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { requestDealIndexing } from '../../../src/lib/google-indexing';
import { GoogleGenerativeAI } from '@google/generative-ai';

const db = getFirestore();
const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

interface Deal {
  id: string;
  title: string;
  description?: string;
  mainCategorySlug?: string;
  subCategorySlug?: string;
  status: 'draft' | 'approved' | 'rejected' | 'expired';
  price: number;
  temperature: number;
  postedAt: string;
  expiryDate?: string;
  updatedAt?: string;
  relatedDeals?: string[];
}

/**
 * Find expired deals
 */
async function findExpiredDeals(): Promise<Deal[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const snapshot = await db
    .collection('deals')
    .where('status', 'in', ['approved', 'draft'])
    .get();

  const expired: Deal[] = [];

  for (const doc of snapshot.docs) {
    const dealData = doc.data() as Omit<Deal, 'id'>;
    const deal = { id: doc.id, ...dealData } as Deal;

    // Check if explicitly expired
    if (deal.expiryDate && new Date(deal.expiryDate) < now) {
      expired.push(deal);
      continue;
    }

    // Check if no activity for 30 days
    const lastUpdate = deal.updatedAt ? new Date(deal.updatedAt) : new Date(deal.postedAt);
    if (lastUpdate < thirtyDaysAgo) {
      expired.push(deal);
    }
  }

  return expired;
}

/**
 * Find similar active deals using Gemini embeddings logic
 * (Simplified: use category + keywords matching)
 */
async function findSimilarDeals(
  deal: Deal,
  limit: number = 3
): Promise<string[]> {
  try {
    const query = db.collection('deals').where('status', '==', 'approved');

    let results = query;

    // Filter by category if available
    if (deal.mainCategorySlug) {
      results = results.where('mainCategorySlug', '==', deal.mainCategorySlug);
    }

    const snapshot = await results.limit(10).get();

    if (snapshot.empty) {
      return [];
    }

    // Score by relevance using Gemini
    const dealsList = snapshot.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }))
      .filter((d) => d.id !== deal.id && (d as any).temperature > 0)
      .slice(0, 5);

    if (dealsList.length === 0) {
      return [];
    }

    // Use Gemini to rank similarity
    const model = genai.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    const prompt = `You are an e-commerce expert. Rate which deals are most similar to this one:

TARGET DEAL: "${deal.title}"
Category: ${deal.mainCategorySlug}
Price: PLN ${deal.price}

CANDIDATE DEALS:
${dealsList.map((d, i) => `${i + 1}. "${(d as any).title}" (${(d as any).price} PLN)`).join('\n')}

Return ONLY a JSON array of the top 3 most similar deal indices: [1, 3, 5]`;

    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 100 },
    });

    const text =
      response.response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const indices = JSON.parse(text) as number[];

    return indices
      .map((idx) => dealsList[idx - 1]?.id)
      .filter(Boolean)
      .slice(0, limit);
  } catch (error) {
    logger.error('[ZombieCleaner] Error finding similar deals:', error);
    return [];
  }
}

/**
 * Main scheduled function
 */
export const seoZombieCleanerCron = onSchedule(
  {
    schedule: '0 3 * * *', // Daily at 3 AM
    timeZone: 'Europe/Warsaw',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (): Promise<void> => {
    logger.info('[ZombieCleaner] Starting scheduled cleanup...');

    try {
      // Check global pause
      const configDoc = await db.collection('config').doc('importSettings').get();
      if (configDoc.exists && configDoc.data()?.isPaused) {
        logger.info('[ZombieCleaner] Skipped - imports are globally paused');
        return;
      }

      // Step 1: Find expired deals
      const expired = await findExpiredDeals();
      logger.info(`[ZombieCleaner] Found ${expired.length} expired deals`);

      if (expired.length === 0) {
        logger.info('[ZombieCleaner] No expired deals to process');
        return;
      }

      let processed = 0;
      let errors = 0;

      // Step 2: Process each expired deal
      for (const deal of expired) {
        try {
          const dealRef = db.collection('deals').doc(deal.id);

          // Step 3: Request removal from Google index
          const indexResult = await requestDealIndexing(deal.id, 'URL_DELETED');

          if (indexResult.success) {
            logger.info(
              `[ZombieCleaner] Requested removal from Google: ${deal.id}`
            );
          }

          // Step 4: Find similar deals for internal linking
          const relatedIds = await findSimilarDeals(deal, 3);

          // Step 5: Update deal status
          await dealRef.update({
            status: 'expired',
            expiredAt: new Date().toISOString(),
            expiredReason: deal.expiryDate ? 'explicit_expiry' : 'inactivity',
            relatedDeals: relatedIds,
            indexingStatus: indexResult.success ? 'removed' : 'removal_failed',
          });

          logger.info(
            `[ZombieCleaner] ✓ Expired deal ${deal.id}, related: [${relatedIds.join(', ')}]`
          );

          processed++;
        } catch (error: any) {
          logger.error(
            `[ZombieCleaner] Failed to process deal ${deal.id}:`,
            error.message
          );
          errors++;
        }
      }

      logger.info(
        `[ZombieCleaner] ✅ Cleanup complete: ${processed} processed, ${errors} errors`
      );
    } catch (error: any) {
      logger.error('[ZombieCleaner] Cron job failed:', error.message);
      throw error;
    }
  }
);
