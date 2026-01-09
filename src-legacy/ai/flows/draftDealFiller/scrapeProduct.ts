/**
 * Stage 1: Web Scraper for Draft Deals
 * 
 * Pobiera HTML strony z linku w draft_deal i ekstrahuje:
 * - Product title
 * - Product description / price
 * - Images
 * - Meta information
 * 
 * Używa cheerio do lightweight parsing (bez headless browser)
 */

import * as https from 'https';
import { load } from 'cheerio';

export interface ScrapedContent {
  title: string;
  description: string;
  imageUrl: string | null;
  price: string | null;
  originalUrl: string;
  scrapedAt: string;
  htmlContent: string; // Raw HTML dla Gemini Vision
}

/**
 * Pobierz HTML z URL
 * @param url - URL do scraping
 * @param timeout - Request timeout w ms
 * @returns HTML content lub null
 */
async function fetchUrl(url: string, timeout = 10000): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.abort();
      reject(new Error(`Timeout fetching ${url}`));
    }, timeout);

    const req = https.get(url, { timeout }, (res) => {
      clearTimeout(timer);

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        // Limit size to 5MB
        if (data.length > 5 * 1024 * 1024) {
          req.abort();
          reject(new Error('Response too large'));
        }
      });

      res.on('end', () => {
        clearTimeout(timer);
        resolve(data);
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Extract product info from HTML using cheerio
 * @param html - HTML content
 * @param originalUrl - Original URL (for context)
 * @returns Scraped content object
 */
function extractFromHtml(html: string, originalUrl: string): ScrapedContent {
  const $ = load(html);

  // Extract title (try multiple selectors)
  let title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    'Product';

  // Extract description
  let description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    $('p').first().text().trim() ||
    '';

  // Extract primary image
  let imageUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('img[alt*="product"], img[alt*="product"]').first().attr('src') ||
    $('img').first().attr('src') ||
    null;

  // Make relative URLs absolute
  if (imageUrl && !imageUrl.startsWith('http')) {
    try {
      const baseUrl = new URL(originalUrl);
      imageUrl = new URL(imageUrl, baseUrl.origin).toString();
    } catch (e) {
      imageUrl = null;
    }
  }

  // Extract price (common patterns)
  let price: string | null = null;
  const priceMatch =
    html.match(/\$[\d,]+\.?\d*/i) ||
    html.match(/PLN\s?[\d,]+\.?\d*/i) ||
    html.match(/€[\d,]+\.?\d*/i);
  if (priceMatch) {
    price = priceMatch[0];
  }

  return {
    title: title.substring(0, 200),
    description: description.substring(0, 500),
    imageUrl,
    price,
    originalUrl,
    scrapedAt: new Date().toISOString(),
    htmlContent: html.substring(0, 10000), // Keep for AI analysis
  };
}

/**
 * Main scraper function
 * @param url - URL to scrape
 * @returns ScrapedContent or null if failed
 */
export async function scrapeProductLink(
  url: string
): Promise<ScrapedContent | null> {
  try {
    // Validate URL
    new URL(url);

    console.log(`[Scraper] Fetching: ${url}`);
    const html = await fetchUrl(url);

    if (!html) {
      console.warn(`[Scraper] No HTML received from ${url}`);
      return null;
    }

    const scraped = extractFromHtml(html, url);
    console.log(`[Scraper] ✓ Extracted from ${url}:`, {
      titleLength: scraped.title.length,
      descriptionLength: scraped.description.length,
      hasImage: !!scraped.imageUrl,
      hasPrice: !!scraped.price,
    });

    return scraped;
  } catch (error: any) {
    console.error(`[Scraper] Failed to scrape ${url}:`, error.message);
    return null;
  }
}

/**
 * Batch scrape multiple URLs
 * @param urls - Array of URLs
 * @param concurrency - Max concurrent requests
 * @returns Array of ScrapedContent (nulls for failures)
 */
export async function scrapeBatch(
  urls: string[],
  concurrency = 3
): Promise<(ScrapedContent | null)[] > {
  const results: (ScrapedContent | null)[] = [];
  const queue = [...urls];

  const worker = async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (url) {
        const content = await scrapeProductLink(url);
        results.push(content);
      }
    }
  };

  const workers = Array(Math.min(concurrency, urls.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}
