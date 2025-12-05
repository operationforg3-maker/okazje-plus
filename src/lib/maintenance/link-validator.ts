/**
 * Link Validator
 * - Check affiliate redirects (Puppeteer/Playwright)
 * - Detect 404s, "Item Missing", expired deals
 * - Flag deals as expired
 * - Batch validation with retry logic
 */

import { logger } from "../logger";
import { db } from "../firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

export interface LinkCheckResult {
  originalUrl: string;
  finalUrl: string;
  statusCode: number;
  isValid: boolean;
  isExpired: boolean;
  reason?: string;
  checkedAt: string;
}

// ===== Link Validator =====
export class LinkValidator {
  private timeout = 10000; // 10s timeout per link
  private maxRetries = 2;

  async validateLink(url: string, retryCount = 0): Promise<LinkCheckResult> {
    try {
      // Use simple fetch first (for affiliate redirects)
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeout),
      });

      const finalUrl = response.url || url;
      const statusCode = response.status;
      const isValid = statusCode >= 200 && statusCode < 400;

      // Check for common "expired" patterns
      const isExpired =
        statusCode === 404 ||
        statusCode === 410 ||
        response.headers.get("x-item-removed") === "true" ||
        (await this.checkForExpiredPatterns(finalUrl));

      return {
        originalUrl: url,
        finalUrl,
        statusCode,
        isValid: isValid && !isExpired,
        isExpired,
        reason: isExpired ? `Status ${statusCode} or expired pattern detected` : undefined,
        checkedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      if (retryCount < this.maxRetries) {
        logger.warn("Link validation retry", {
          url,
          retryCount,
          error: error.message,
        });
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.validateLink(url, retryCount + 1);
      }

      logger.error("Link validation failed", { url, error: error.message });
      return {
        originalUrl: url,
        finalUrl: "",
        statusCode: 0,
        isValid: false,
        isExpired: true,
        reason: `Validation error: ${error.message}`,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  private async checkForExpiredPatterns(url: string): Promise<boolean> {
    // Check common patterns in URL or content
    const expiredPatterns = [
      /item.*not.*found/i,
      /product.*removed/i,
      /out.*of.*stock/i,
      /no.*longer.*available/i,
      /deal.*expired/i,
    ];

    // Simple heuristic: check URL for patterns
    return expiredPatterns.some((pattern) => pattern.test(url));
  }

  // ===== Batch validation =====
  async validateDeals(): Promise<{ checked: number; expired: number }> {
    try {
      const dealsCollection = collection(db, "deals");
      const q = query(dealsCollection, where("status", "==", "approved"));
      const snapshot = await getDocs(q);

      let checked = 0;
      let expired = 0;

      for (const dealDoc of snapshot.docs) {
        const deal = dealDoc.data();
        const result = await this.validateLink(deal.link || deal.affiliateUrl);

        if (!result.isValid || result.isExpired) {
          // Flag as expired
          await updateDoc(dealDoc.ref, {
            status: "expired",
            expiryDate: new Date().toISOString(),
            linkCheckResult: result,
          });
          expired++;
          logger.info("Deal flagged as expired", { dealId: dealDoc.id, reason: result.reason });
        } else {
          // Update check timestamp
          await updateDoc(dealDoc.ref, {
            lastLinkCheck: new Date().toISOString(),
            linkValid: true,
          });
        }

        checked++;

        // Rate limiting
        if (checked % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      logger.info("Batch link validation completed", { checked, expired });
      return { checked, expired };
    } catch (error) {
      logger.error("Batch validation failed", { error });
      throw error;
    }
  }

  // ===== Single deal validation =====
  async validateDeal(dealId: string): Promise<LinkCheckResult | null> {
    try {
      const dealRef = doc(collection(db, "deals"), dealId);
      const dealSnap = await getDocs(query(collection(db, "deals"), where("__name__", "==", dealId)));

      if (dealSnap.empty) {
        logger.warn("Deal not found", { dealId });
        return null;
      }

      const deal = dealSnap.docs[0].data();
      const result = await this.validateLink(deal.link || deal.affiliateUrl);

      // Update deal document
      await updateDoc(dealSnap.docs[0].ref, {
        lastLinkCheck: new Date().toISOString(),
        linkValid: result.isValid && !result.isExpired,
        linkCheckResult: result,
      });

      return result;
    } catch (error) {
      logger.error("Single deal validation failed", { dealId, error });
      return null;
    }
  }
}

// ===== Singleton =====
let validatorInstance: LinkValidator | null = null;

export function getLinkValidator(): LinkValidator {
  if (!validatorInstance) {
    validatorInstance = new LinkValidator();
  }
  return validatorInstance;
}

// ===== Scheduled task (Cloud Scheduler trigger) =====
export async function validateAllDealsScheduled(): Promise<void> {
  const validator = getLinkValidator();
  try {
    const result = await validator.validateDeals();
    logger.info("Scheduled link validation completed", result);
  } catch (error) {
    logger.error("Scheduled link validation failed", { error });
  }
}
