import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { adminDb } from '../src/lib/firebase-admin';
import { createAliExpressClient } from '../src/integrations/aliexpress/client';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

interface AuditItem {
  dealId: string;
  productId: string;
  title: string;
  sourceUrl: string;
  
  // Firestore data
  dbPrice: number;
  dbOriginalPrice?: number;
  dbStoreName?: string;
  dbStoreRating?: any;
  dbShippingCost?: number;
  dbDeliveryDays?: number;

  // API data
  apiSuccess: boolean;
  apiPrice?: number;
  apiOriginalPrice?: number;
  apiStoreName?: string;
  apiStoreRating?: string;
  apiShippingCost?: number;
  apiDeliveryDays?: number;

  // HTML Scraped data
  htmlSuccess: boolean;
  htmlTitle?: string;
  htmlPrice?: number;
  htmlOriginalPrice?: number;
  htmlStoreName?: string;
  htmlStoreRating?: string;
  htmlStoreFollowers?: number;
  htmlShippingCost?: number;
  htmlDeliveryDays?: number;
}

// Helper to parse shipping texts
function parseShippingText(text: string): { cost: number; isFree: boolean } {
  const lower = text.toLowerCase();
  if (lower.includes('darmow') || lower.includes('bezpłat') || lower.includes('free') || lower.includes('gratis')) {
    return { cost: 0, isFree: true };
  }
  const cleaned = text.replace(',', '.');
  const match = cleaned.match(/([\d\.]+)/);
  if (match) {
    const cost = parseFloat(match[1]);
    if (!isNaN(cost)) {
      return { cost, isFree: cost === 0 };
    }
  }
  return { cost: 0, isFree: false };
}

// Helper to parse delivery days
function parseDeliveryDays(text: string, referenceDate: Date = new Date()): number {
  const lower = text.toLowerCase();
  const daysMatch = lower.match(/(\d+)\s*-?\s*day/i);
  if (daysMatch) {
    return parseInt(daysMatch[1], 10);
  }
  
  const plMonths: Record<string, number> = {
    'sty': 0, 'lut': 1, 'mar': 2, 'kwi': 3, 'maj': 4, 'cze': 5,
    'lip': 6, 'sie': 7, 'wrz': 8, 'paź': 9, 'lis': 10, 'gru': 11
  };
  const enMonths: Record<string, number> = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };

  const tokens = text.replace(':', ' ').split(/\s+/).filter(Boolean);
  let targetDate: Date | null = null;
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toLowerCase();
    const monthIndex = plMonths[token.slice(0, 3)] ?? enMonths[token.slice(0, 3)];
    if (monthIndex !== undefined) {
      let day = NaN;
      if (i > 0) day = parseInt(tokens[i - 1], 10);
      if (isNaN(day) && i < tokens.length - 1) day = parseInt(tokens[i + 1], 10);

      if (!isNaN(day)) {
        const year = referenceDate.getFullYear();
        const cand = new Date(year, monthIndex, day);
        if (cand.getTime() < referenceDate.getTime() - 30 * 24 * 3600 * 1000) {
          cand.setFullYear(year + 1);
        }
        if (!targetDate || cand.getTime() < targetDate.getTime()) {
          targetDate = cand;
        }
      }
    }
  }

  if (targetDate) {
    const diffMs = targetDate.getTime() - referenceDate.getTime();
    return Math.max(1, Math.round(diffMs / (24 * 3600 * 1000)));
  }

  return 7; // fallback default
}

async function runAudit() {
  console.log('Querying sample AliExpress deals from Firestore...');
  const dealsSnap = await adminDb.collection('deals')
    .where('source', '==', 'aliexpress')
    .limit(5)
    .get();

  if (dealsSnap.empty) {
    console.error('No AliExpress deals found in database.');
    return;
  }

  const client = createAliExpressClient();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const auditResults: AuditItem[] = [];

  try {
    for (const dealDoc of dealsSnap.docs) {
      const deal = dealDoc.data();
      const productId = deal.productId || deal.productCoreId;
      const aliId = String(deal.sourceProductId);
      const url = deal.sourceUrl || `https://www.aliexpress.com/item/${aliId}.html`;

      console.log(`\n----------------------------------------`);
      console.log(`Auditing Deal: ${dealDoc.id} (AliExpress ID: ${aliId})`);
      console.log(`Title: ${deal.title?.pl || deal.title?.en}`);

      // 1. Fetch related product core from DB
      const productSnap = await adminDb.collection('product_cores').doc(productId).get();
      const product = productSnap.exists ? productSnap.data() : null;

      const dbPrice = (deal.price?.amount || 0);
      const dbOriginalPrice = deal.originalPrice;
      const dbStoreName = product?.seller?.name || deal.seller?.name;
      const dbStoreRating = product?.seller?.positiveRate || product?.seller?.score;
      const dbShippingCost = product?.logistics?.shippingCost || (deal.shipping?.cost ?? 0);
      const dbDeliveryDays = product?.logistics?.deliveryDays || deal.shipping?.deliveryDays;

      const item: AuditItem = {
        dealId: dealDoc.id,
        productId,
        title: deal.title?.pl || deal.title?.en || 'No Title',
        sourceUrl: url,
        dbPrice,
        dbOriginalPrice,
        dbStoreName,
        dbStoreRating,
        dbShippingCost,
        dbDeliveryDays,
        apiSuccess: false,
        htmlSuccess: false
      };

      // 2. Query AliExpress API
      console.log(`Querying Affiliate API...`);
      try {
        const apiDetails = await client.getProductDetails({ productId: aliId });
        const apiProduct = apiDetails?.resp_result?.result?.products?.product?.[0];
        if (apiProduct) {
          item.apiSuccess = true;
          item.apiPrice = parseFloat(apiProduct.target_sale_price);
          item.apiOriginalPrice = parseFloat(apiProduct.original_price);
          item.apiStoreName = apiProduct.store_info?.store_name;
          item.apiStoreRating = apiProduct.store_info?.positive_rate;
          item.apiDeliveryDays = apiProduct.ship_to_days ? parseInt(apiProduct.ship_to_days, 10) : undefined;
          console.log(`  -> API Success! Price: ${item.apiPrice} PLN, Seller: ${item.apiStoreName}`);
        } else {
          console.log(`  -> API empty or non-affiliate product.`);
        }
      } catch (apiErr: any) {
        console.error(`  -> API Request failed:`, apiErr.message || apiErr);
      }

      // 3. Navigate & Scrape using Puppeteer
      console.log(`Scraping Page HTML via Puppeteer...`);
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8' });
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const scraped = await page.evaluate(`(() => {
          const text = (sel) => document.querySelector(sel)?.textContent?.trim() || null;
          
          // Current price selectors
          const priceSelectors = [
            '.price-default--current--F8OlYIo',
            '[class*="price-default--current"]',
            '.product-price-value',
            '[class*="price-value"]',
            '[class*="priceText"]',
            '.price'
          ];
          let currentPriceText = null;
          for (const sel of priceSelectors) {
            currentPriceText = text(sel);
            if (currentPriceText && currentPriceText.includes('zł')) break;
          }

          // Original / lowest 30d price selectors
          const originPriceSelectors = [
            '.price--lastOrigin--vV459Fr',
            '[class*="price--lastOrigin"]',
            '[class*="price-original"]',
            '[class*="original-price"]'
          ];
          let originalPriceText = null;
          for (const sel of originPriceSelectors) {
            originalPriceText = text(sel);
            if (originalPriceText) break;
          }

          // Store Name
          const storeNameSelectors = [
            '.store-detail--storeName--Lk2FVZ4',
            '[class*="store-detail--storeName"]',
            '.store-info--name--E2VWTyv a',
            '[class*="store-info--name"] a',
            'a[data-pl="store-name"]'
          ];
          let storeName = null;
          for (const sel of storeNameSelectors) {
            storeName = text(sel);
            if (storeName) break;
          }

          // Store rating and followers from description block
          const storeDescText = text('[class*="store-info--desc"]') || text('[class*="store-info--content"]') || '';

          // Find shipping & delivery texts
          const shippingTexts = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          const keywords = ['wysył', 'dostaw', 'shipp', 'deliver', 'darmow', 'bezpłat', 'free'];
          while (node = walker.nextNode()) {
            const val = node.textContent?.trim();
            if (val) {
              const lower = val.toLowerCase();
              if (keywords.some(k => lower.includes(k))) {
                const parent = node.parentElement;
                if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE' && parent.tagName !== 'NOSCRIPT') {
                  shippingTexts.push(val);
                }
              }
            }
          }

          return {
            title: document.title || null,
            h1Title: text('h1'),
            currentPriceText,
            originalPriceText,
            storeName,
            storeDescText,
            shippingTexts
          };
        })()`);

        await page.close();

        if (scraped) {
          item.htmlSuccess = true;
          item.htmlTitle = scraped.h1Title || scraped.title || undefined;

          // Parse prices
          if (scraped.currentPriceText) {
            const cleanPrice = scraped.currentPriceText.replace(',', '.').replace(/[^\d\.]/g, '');
            item.htmlPrice = parseFloat(cleanPrice);
          }
          if (scraped.originalPriceText) {
            const cleanOrigin = scraped.originalPriceText.replace(',', '.').replace(/[^\d\.]/g, '');
            item.htmlOriginalPrice = parseFloat(cleanOrigin);
          }

          // Store Name fallback
          item.htmlStoreName = scraped.storeName || undefined;

          // Parse rating & followers
          const ratingMatch = scraped.storeDescText.match(/(\d+(?:\.\d+)?)\s*%/);
          if (ratingMatch) {
            item.htmlStoreRating = ratingMatch[1] + '%';
          }
          
          const followersMatch = scraped.storeDescText.match(/(\d[\d\s]*)\s*(?:Obserwujący|Follower)/i);
          if (followersMatch) {
            item.htmlStoreFollowers = parseInt(followersMatch[1].replace(/\s/g, ''), 10);
          }

          // Parse logistics
          const logData = extractShippingAndDeliveryFromTexts(scraped.shippingTexts);
          item.htmlShippingCost = logData.shippingCost;
          item.htmlDeliveryDays = logData.deliveryDays;

          console.log(`  -> HTML Scraped Success! Price: ${item.htmlPrice} PLN, Store: ${item.htmlStoreName}, Rating: ${item.htmlStoreRating}, Followers: ${item.htmlStoreFollowers}, Shipping: ${item.htmlShippingCost} PLN, Delivery Days: ${item.htmlDeliveryDays}`);
        }
      } catch (htmlErr: any) {
        console.error(`  -> HTML Scrape failed:`, htmlErr.message || htmlErr);
      }

      auditResults.push(item);
    }
  } finally {
    await browser.close();
  }

  // 4. Generate report markdown
  generateReport(auditResults);
}

function extractShippingAndDeliveryFromTexts(texts: string[]): { shippingCost: number; deliveryDays: number } {
  let shippingCost = 0;
  let isFreeShipping = false;
  let deliveryDays = 7;

  const shippingText = texts.find(t => t.toLowerCase().includes('wysyłka:') || t.toLowerCase().includes('shipping:'));
  if (shippingText) {
    const lower = shippingText.toLowerCase();
    if (lower.includes('darmow') || lower.includes('bezpłat') || lower.includes('free') || lower.includes('gratis')) {
      isFreeShipping = true;
      shippingCost = 0;
    } else {
      const match = shippingText.replace(',', '.').match(/([\d\.]+)/);
      if (match) {
        shippingCost = parseFloat(match[1]);
      }
    }
  } else {
    const hasFree = texts.some(t => {
      const lower = t.toLowerCase();
      return (lower.includes('darmowa') || lower.includes('free') || lower.includes('bezpłatna')) && lower.includes('wysył');
    });
    if (hasFree) {
      isFreeShipping = true;
      shippingCost = 0;
    }
  }

  const deliveryText = texts.find(t => t.toLowerCase().includes('dostawa:') || t.toLowerCase().includes('delivery:') || t.toLowerCase().includes('delivered by'));
  if (deliveryText) {
    deliveryDays = parseDeliveryDays(deliveryText);
  }

  return { shippingCost, deliveryDays };
}

function generateReport(results: AuditItem[]) {
  let report = `# AliExpress Product Audit & Comparison Report\n\n`;
  report += `*Generated: ${new Date().toLocaleString()}*\n\n`;
  report += `This report compares data currently stored in our **Firestore database (deals & product_cores)** with **Live AliExpress Affiliate API** results and **Live HTML Scraped** data from the rendered product pages.\n\n`;

  report += `## Summary of Findings\n\n`;

  let totalItems = results.length;
  let apiSuccesses = results.filter(r => r.apiSuccess).length;
  let htmlSuccesses = results.filter(r => r.htmlSuccess).length;

  report += `| Indicator | Value |\n`;
  report += `| --- | --- |\n`;
  report += `| Total Products Audited | ${totalItems} |\n`;
  report += `| Affiliate API Coverage (Successes) | ${apiSuccesses} / ${totalItems} (${Math.round((apiSuccesses/totalItems)*100)}%) |\n`;
  report += `| HTML Scraper Coverage (Successes) | ${htmlSuccesses} / ${totalItems} (${Math.round((htmlSuccesses/totalItems)*100)}%) |\n\n`;

  report += `> [!NOTE]\n`;
  report += `> **API Limitations:** AliExpress Affiliate API returns empty results for products that have left the affiliate program or expired, even if they remain active on the platform. HTML Scraping serves as a critical fallback.\n\n`;

  report += `## Comparison Details\n\n`;

  for (const item of results) {
    report += `### Product: [${item.title.slice(0, 50)}...](${item.sourceUrl})\n`;
    report += `- **AliExpress ID:** \`${item.productId}\` (Deal ID: \`${item.dealId}\`)\n\n`;
    
    report += `| Field | Firestore (DB) | Live AliExpress API | Live Scraped (HTML) | Match Status |\n`;
    report += `| --- | --- | --- | --- | --- |\n`;
    
    // Price
    const priceMatch = item.htmlSuccess && item.htmlPrice ? (item.dbPrice === item.htmlPrice ? '✅ Match' : `❌ Mismatch (DB: ${item.dbPrice} vs Live: ${item.htmlPrice})`) : 'N/A';
    report += `| **Price (PLN)** | ${item.dbPrice} PLN | ${item.apiSuccess ? item.apiPrice + ' PLN' : 'Empty'} | ${item.htmlSuccess ? item.htmlPrice + ' PLN' : 'Empty'} | ${priceMatch} |\n`;
    
    // Original Price
    const origMatch = item.htmlSuccess && item.htmlOriginalPrice ? (item.dbOriginalPrice === item.htmlOriginalPrice ? '✅ Match' : `⚠️ Diff (DB: ${item.dbOriginalPrice || 'None'} vs Live: ${item.htmlOriginalPrice})`) : 'N/A';
    report += `| **Original Price** | ${item.dbOriginalPrice || 'None'} | ${item.apiSuccess ? item.apiOriginalPrice || 'None' : 'Empty'} | ${item.htmlSuccess ? item.htmlOriginalPrice || 'None' : 'Empty'} | ${origMatch} |\n`;

    // Seller Info
    const sellerMatch = item.htmlSuccess && item.htmlStoreName ? (item.dbStoreName === item.htmlStoreName ? '✅ Match' : `⚠️ Diff (DB: "${item.dbStoreName || ''}" vs Live: "${item.htmlStoreName}")`) : 'N/A';
    report += `| **Seller Name** | "${item.dbStoreName || 'Missing'}" | "${item.apiSuccess ? item.apiStoreName || 'Missing' : 'Empty'}" | "${item.htmlSuccess ? item.htmlStoreName || 'Missing' : 'Empty'}" | ${sellerMatch} |\n`;
    
    // Rating
    const ratingMatch = item.htmlSuccess && item.htmlStoreRating ? (String(item.dbStoreRating) === String(item.htmlStoreRating) ? '✅ Match' : `⚠️ Diff (DB: ${item.dbStoreRating || 'Missing'} vs Live: ${item.htmlStoreRating})`) : 'N/A';
    report += `| **Store Rating** | ${item.dbStoreRating || 'Missing'} | ${item.apiSuccess ? item.apiStoreRating || 'Missing' : 'Empty'} | ${item.htmlSuccess ? item.htmlStoreRating || 'Missing' : 'Empty'} | ${ratingMatch} |\n`;

    // Shipping Cost
    const shipMatch = item.htmlSuccess && item.htmlShippingCost !== undefined ? (item.dbShippingCost === item.htmlShippingCost ? '✅ Match' : `❌ Mismatch (DB: ${item.dbShippingCost} vs Live: ${item.htmlShippingCost})`) : 'N/A';
    report += `| **Shipping Cost** | ${item.dbShippingCost || 0} PLN | ${item.apiSuccess ? item.apiShippingCost ?? 'N/A' : 'Empty'} | ${item.htmlSuccess ? item.htmlShippingCost + ' PLN' : 'Empty'} | ${shipMatch} |\n`;

    // Delivery Days
    const delMatch = item.htmlSuccess && item.htmlDeliveryDays !== undefined ? (item.dbDeliveryDays === item.htmlDeliveryDays ? '✅ Match' : `⚠️ Diff (DB: ${item.dbDeliveryDays} vs Live: ${item.htmlDeliveryDays})`) : 'N/A';
    report += `| **Delivery Days** | ${item.dbDeliveryDays || 'Missing'} days | ${item.apiSuccess ? item.apiDeliveryDays || 'N/A' : 'Empty'} | ${item.htmlSuccess ? item.htmlDeliveryDays + ' days' : 'Empty'} | ${delMatch} |\n\n`;
  }

  report += `## Gaps & Recommendations\n\n`;
  report += `1. **HTML Scraper completeness:** Currently, the production harvester scraper (\`scrapeAliExpressPage\` in [harvester.ts](file:///Users/tomaszgorecki/Projekty/okazje-plus/src/lib/automation/harvester.ts)) only extracts \`description\`, \`specs\` (brand, sku, mpn, model), and \`images\`. It **completely ignores** store names, ratings, followers, shipping costs, delivery times, and prices.\n`;
  report += `2. **Missing data on Draft import:** If the API details return empty (which is common for older products or non-affiliate links), the harvester falls back to scraping HTML. But since the HTML scraper doesn't fetch prices, store details, or shipment details, the product core is left draft/incomplete or lacks essential buyer metadata.\n`;
  report += `3. **API Access Token limitations:** Shipping info via \`aliexpress.logistics.buyer.freight.get\` is completely failing because it requires OAuth. Spawning Puppeteer as a fallback to scrape shipping and seller data from the page allows us to capture this data language-agnostically.\n\n`;

  const reportPath = path.join('/Users/tomaszgorecki/.gemini/antigravity-ide/brain/e78dfe75-64e9-4075-a157-22d90a3341e2', 'ALIEXPRESS_COMPARISON_REPORT.md');
  fs.writeFileSync(reportPath, report);
  console.log(`Saved comparison report to: ${reportPath}`);
}

runAudit();
