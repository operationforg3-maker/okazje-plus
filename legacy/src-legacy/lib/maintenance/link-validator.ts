/**
 * Link Validator
 * - Check affiliate redirects with Puppeteer for JavaScript-heavy redirects
 * - Detect 404s, soft-404s, "Item Missing", expired deals
 * - Handle AliExpress affiliate link chains
 * - Flag deals as expired
 * - Batch validation with retry logic
 */

import { logger } from "@/lib/logging";
import { db } from "../firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import puppeteer, { Browser, Page } from "puppeteer";

export interface LinkCheckResult {
  originalUrl: string;
  finalUrl: string;
  statusCode: number;
  isValid: boolean;
  isExpired: boolean;
  reason?: string;
  checkedAt: string;
  usedPuppeteer?: boolean;
}

// ===== Link Validator =====
export class LinkValidator {
  private timeout = 15000; // 15s timeout per link (Puppeteer needs more time)
  private maxRetries = 2;
  private browser: Browser | null = null;
  
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          headless: true, // Use standard puppeteer headless mode
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      } catch (error) {
        logger.error("Failed to launch Puppeteer browser", { error });
        throw error;
      }
    }
    return this.browser;
  }

  async validateLink(url: string, retryCount = 0): Promise<LinkCheckResult> {
    try {
      // First, try simple fetch (fast path for non-JS redirects)
      const simpleResult = await this.trySimpleFetch(url);
      if (simpleResult) {
        return { ...simpleResult, usedPuppeteer: false };
      }

      // If simple fetch fails or returns redirect-like pattern, use Puppeteer
      logger.debug("Falling back to Puppeteer for JavaScript redirect handling", { url });
      const puppeteerResult = await this.tryPuppeteerNavigation(url);
      return { ...puppeteerResult, usedPuppeteer: true };
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

      logger.error("Link validation failed after retries", { 
        url, 
        error: error.message,
        retryCount 
      });
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

  /**
   * Try simple HEAD/GET fetch first (faster, for direct links)
   */
  private async trySimpleFetch(url: string): Promise<LinkCheckResult | null> {
    try {
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
        statusCode >= 500 ||
        response.headers.get("x-item-removed") === "true" ||
        (await this.checkForExpiredPatterns(finalUrl));

      // If fetch succeeded with good status, return early
      if (isValid && !isExpired) {
        return {
          originalUrl: url,
          finalUrl,
          statusCode,
          isValid: true,
          isExpired: false,
          checkedAt: new Date().toISOString(),
        };
      }

      // If got 404 or clear expiry signal, return that
      if (isExpired) {
        return {
          originalUrl: url,
          finalUrl,
          statusCode,
          isValid: false,
          isExpired: true,
          reason: `HTTP ${statusCode} or expired pattern detected`,
          checkedAt: new Date().toISOString(),
        };
      }

      // For 3xx/other responses, return null to trigger Puppeteer
      return null;
    } catch (error: any) {
      // Timeout or fetch error - try Puppeteer
      logger.debug("Simple fetch failed, will try Puppeteer", { 
        url, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Use Puppeteer to handle JavaScript-based redirects and soft-404 detection
   */
  private async tryPuppeteerNavigation(url: string): Promise<LinkCheckResult> {
    let page: Page | null = null;

    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      // Set viewport to detect mobile soft-404s
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate with timeout
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.timeout,
      });

      const finalUrl = page.url();
      const statusCode = response?.status() || 200;

      // Check for soft-404 patterns (content-based detection)
      const pageContent = await page.content();
      const isSoft404 = this.detectSoft404(pageContent, finalUrl);
      const isExpired = await this.checkForExpiredPatternsInContent(page);

      const isValid = statusCode >= 200 && statusCode < 400 && !isSoft404;

      return {
        originalUrl: url,
        finalUrl,
        statusCode,
        isValid: isValid && !isExpired,
        isExpired: isSoft404 || isExpired || statusCode === 404,
        reason: isSoft404
          ? "Soft-404 detected (product not available)"
          : isExpired
            ? "Expired pattern detected in content"
            : `HTTP ${statusCode}`,
        checkedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error("Puppeteer navigation failed", {
        url,
        error: error.message,
      });

      return {
        originalUrl: url,
        finalUrl: "",
        statusCode: 0,
        isValid: false,
        isExpired: true,
        reason: `Puppeteer error: ${error.message}`,
        checkedAt: new Date().toISOString(),
      };
    } finally {
      if (page) {
        await page.close().catch((err) =>
          logger.warn("Failed to close Puppeteer page", { error: err.message })
        );
      }
    }
  }

  /**
   * Detect soft-404 (page exists but product is gone) using HTML patterns
   */
  private detectSoft404(html: string, url: string): boolean {
    const soft404Patterns = [
      /product.*not.*found/i,
      /item.*not.*available/i,
      /404\s+not\s+found/i,
      /no results/i,
      /sorry.*out.*stock/i,
      /item.*removed/i,
      /deal.*expired/i,
      /access\s+denied/i,
      /page\s+not\s+found/i,
    ];

    const inUrl = soft404Patterns.some((p) => p.test(url));
    const inContent = soft404Patterns.some((p) => p.test(html));

    return inUrl || inContent;
  }

  /**
   * Check for expiration patterns in page content (via Puppeteer)
   */
  private async checkForExpiredPatternsInContent(page: Page): Promise<boolean> {
    try {
      // Check page title and common header/notice elements
      const pageTitle = await page.title();
      const noticeElement = await page.$(".notice, .error, .warning, .expired");
      const noticeText = noticeElement ? await page.evaluate((el) => el?.textContent || "", noticeElement) : "";

      const expiredPatterns = [
        /expired/i,
        /no longer available/i,
        /out of stock/i,
        /item removed/i,
        /deal ended/i,
      ];

      return (
        expiredPatterns.some((p) => p.test(pageTitle)) ||
        expiredPatterns.some((p) => p.test(noticeText || ""))
      );
    } catch (error) {
      // If selector doesn't exist, that's fine - page is probably OK
      return false;
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

  /**
   * Close Puppeteer browser instance to free resources
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.info("Puppeteer browser closed");
      } catch (error) {
        logger.error("Failed to close Puppeteer browser", { error });
      }
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

/**
 * Cleanup validator and close browser resources
 * Call this before process exit or in cleanup handlers
 */
export async function cleanupLinkValidator(): Promise<void> {
  if (validatorInstance) {
    await validatorInstance.closeBrowser();
    validatorInstance = null;
  }
}

// ===== Scheduled task (Cloud Scheduler trigger) =====
export async function validateAllDealsScheduled(): Promise<void> {
  const validator = getLinkValidator();
  try {
    const result = await validator.validateDeals();
    logger.info("Scheduled link validation completed", result);
  } catch (error) {
    logger.error("Scheduled link validation failed", { error });
  } finally {
    // Clean up browser resources after batch validation
    await validator.closeBrowser();
  }
}
