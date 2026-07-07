/**
 * AliExpress Puppeteer Scraper — Cloud Functions edition
 *
 * Differences from src/integrations/aliexpress/scraper.ts:
 *   - Uses `puppeteer-core` + `@sparticuz/chromium` (serverless-optimized, ~60MB)
 *   - executablePath provided by @sparticuz/chromium
 *
 * Keep in sync with src/integrations/aliexpress/scraper.ts for feature changes.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeFetch = require('node-fetch');

export interface ScrapedReview {
  rating: number;
  content?: string;
  translatedContent?: string;
  images: string[];
  country?: string;
  date?: string;
  skuInfo?: string;
}

export interface ScrapedAliExpressData {
  title?: string;
  descriptionHtml?: string;
  descriptionImages?: string[];
  specs?: Record<string, string>;
  images?: string[];
  mainImage?: string;
  videoUrl?: string;
  seller?: {
    name: string;
    storeUrl?: string;
    rating?: number;
    followers?: number;
    positiveRate?: string;
  };
  shippingCost?: number;
  shippingDays?: number;
  price?: number;
  originalPrice?: number;
  variants?: Array<{ id: string; name: string; values: string[] }>;
  skuList?: Array<{
    skuId: string;
    available: boolean;
    attributes: Array<{ name: string; value: string; image?: string }>;
    price?: number;
    stock?: number;
    image?: string;
  }>;
  reviewImages?: string[];
  reviews?: ScrapedReview[];
}

function normaliseAliExpressImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) url = `https:${url}`;
  url = url.replace(/(_\d+x\d+)\.(jpg|webp|png)$/i, '.$2');
  return url;
}

function isValidAliCdnUrl(url: string): boolean {
  return url.startsWith('https://') &&
    (url.includes('alicdn.com') || url.includes('aliexpress-media.com'));
}

function extractReviewImages(reviewItem: any): string[] {
  const raw: string[] = [];
  if (Array.isArray(reviewItem.images)) {
    for (const u of reviewItem.images) { if (typeof u === 'string') raw.push(u); }
  }
  if (Array.isArray(reviewItem.imageList)) {
    for (const img of reviewItem.imageList) {
      const u = img?.imgUrl || img?.url || img;
      if (typeof u === 'string') raw.push(u);
    }
  }
  if (Array.isArray(reviewItem.imagePathList)) {
    for (const u of reviewItem.imagePathList) { if (typeof u === 'string') raw.push(u); }
  }
  return raw.map(normaliseAliExpressImageUrl).filter(isValidAliCdnUrl);
}

function isFeedbackUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (lower.includes('aliexpress') || lower.includes('aeserver')) &&
    (lower.includes('feedback') || lower.includes('evaluation') ||
     lower.includes('evalist') || lower.includes('review'));
}

export async function scrapeAliExpressProduct(productId: string): Promise<ScrapedAliExpressData> {
  const url = `https://pl.aliexpress.com/item/${productId}.html`;
  console.log(`[AliExpress Scraper CF] Launching Chromium for: ${productId}`);

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless as boolean | 'shell',
  });

  const result: ScrapedAliExpressData = {
    specs: {}, images: [], variants: [], skuList: [],
    reviewImages: [], reviews: [], descriptionImages: [],
  };

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8' });
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      (window as any).chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
      Object.defineProperty(navigator, 'languages', { get: () => ['pl-PL', 'pl', 'en-US', 'en'] });
    });

    let pcDescUrl = '';
    let mtopVariants: any[] = [];
    let mtopSkuList: any[] = [];
    const reviewImageSet = new Set<string>();
    const reviewsList: ScrapedReview[] = [];

    page.on('response', async (response) => {
      const respUrl = response.url();

      if (respUrl.includes('mtop.aliexpress.pdp.msite.query')) {
        try {
          const buffer = await response.buffer();
          let text = buffer.toString('utf-8').trim();
          const jsonpMatch = text.match(/^\s*\w+\(([\s\S]*)\)\s*;?\s*$/);
          if (jsonpMatch) text = jsonpMatch[1].trim();
          const mtopJson = JSON.parse(text);
          const resObj = mtopJson?.data?.result || mtopJson?.result || mtopJson;
          if (resObj) {
            const descConfig = resObj.DESC;
            if (descConfig?.pcDescUrl || descConfig?.msiteDescUrl) {
              pcDescUrl = descConfig.pcDescUrl || descConfig.msiteDescUrl;
            }
            const rawProperties = resObj.SKU?.skuProperties || [];
            mtopVariants = rawProperties.map((prop: any) => ({
              id: String(prop.skuPropertyId), name: prop.skuPropertyName,
              values: prop.skuPropertyValues?.map((val: any) => val.propertyValueName) || [],
            }));
            const shippingLayoutList = resObj.SHIPPING?.deliveryLayoutInfo || resObj.SHIPPING?.originalLayoutResultList;
            if (Array.isArray(shippingLayoutList) && shippingLayoutList.length > 0) {
              let cheapestCost = Infinity; let cheapestDays = 7;
              for (const option of shippingLayoutList) {
                const bd = option.bizData; if (!bd) continue;
                const amount = bd.displayAmount !== undefined ? Number(bd.displayAmount)
                  : (bd.shippingFee === 'free' ? 0 : parseFloat(String(bd.formattedAmount || '0').replace(',', '.')));
                if (Number.isFinite(amount) && amount < cheapestCost) { cheapestCost = amount; cheapestDays = Number(bd.deliveryDayMax || bd.deliveryDayMin || 7); }
              }
              if (cheapestCost !== Infinity) { result.shippingCost = cheapestCost; result.shippingDays = cheapestDays; }
            }
            const skuPaths = resObj.SKU?.skuPaths || [];
            const skuPriceInfoMap = resObj.PRICE?.skuPriceInfoMap || {};
            const skuImagesMap = resObj.HEADER_IMAGE_PC?.skuImagesMap || {};
            const valueIdToNameMap = new Map<string, string>();
            const valueIdToImageMap = new Map<string, string>();
            rawProperties.forEach((prop: any) => {
              prop.skuPropertyValues?.forEach((val: any) => {
                valueIdToNameMap.set(String(val.propertyValueId), val.propertyValueName);
                if (val.skuPropertyImagePath) valueIdToImageMap.set(String(val.propertyValueId), val.skuPropertyImagePath);
              });
            });
            mtopSkuList = skuPaths.map((pe: any) => {
              const skuId = String(pe.skuIdStr || pe.skuId);
              const stock = pe.skuStock ?? 0;
              const available = pe.salable !== false && stock > 0;
              const attributes: Array<{ name: string; value: string; image?: string }> = [];
              (pe.path || '').split(';').forEach((seg: string) => {
                const [propId, valId] = seg.split(':');
                if (propId && valId) {
                  const prop = rawProperties.find((p: any) => String(p.skuPropertyId) === propId);
                  const propName = prop ? prop.skuPropertyName : `Prop_${propId}`;
                  const valName = valueIdToNameMap.get(valId) || `Val_${valId}`;
                  const valImage = valueIdToImageMap.get(valId);
                  attributes.push({ name: propName, value: valName, ...(valImage ? { image: valImage } : {}) });
                }
              });
              const priceInfo = skuPriceInfoMap[skuId];
              let price: number | undefined;
              if (priceInfo?.salePriceLocal) {
                const parts = priceInfo.salePriceLocal.split('|');
                if (parts.length >= 3) price = Number(parts[1] + '.' + parts[2]);
              }
              const imgList = skuImagesMap[skuId];
              const image = (Array.isArray(imgList) && imgList.length > 0) ? imgList[0] : undefined;
              return { skuId, available, attributes, price, stock, image };
            });
          }
        } catch (e: any) { console.warn(`[CF Scraper] MTOP parse error: ${e.message}`); }
      }

      if (isFeedbackUrl(respUrl)) {
        try {
          const buffer = await response.buffer();
          let text = buffer.toString('utf-8').trim();
          const jsonpMatch = text.match(/^\s*\w+\(([\s\S]*)\)\s*;?\s*$/);
          if (jsonpMatch) text = jsonpMatch[1].trim();
          const feedbackJson = JSON.parse(text);
          const evaList: any[] =
            feedbackJson?.data?.evaListResult?.evaList ||
            feedbackJson?.data?.result?.feedbackList ||
            feedbackJson?.result?.evaList ||
            feedbackJson?.data?.feedbackList || [];
          for (const review of evaList) {
            const imgs = extractReviewImages(review);
            if (imgs.length === 0) continue;
            imgs.forEach(u => reviewImageSet.add(u));
            if (reviewsList.length < 10) {
              reviewsList.push({
                rating: Number(review.star ?? review.rating ?? 5),
                content: review.content || review.buyerFeedback || undefined,
                translatedContent: review.buyerTranslationFeedback || undefined,
                images: imgs,
                country: review.buyerCountry || review.country || undefined,
                date: review.feedbackDate || review.date || undefined,
                skuInfo: review.skuInfo || review.skuProperties || undefined,
              });
            }
          }
          if (reviewImageSet.size > 0) {
            console.log(`[CF Scraper] reviewImages total: ${reviewImageSet.size}`);
          }
        } catch { /* skip */ }
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

    try {
      await page.evaluate(`(() => {
        window.scrollTo(0, document.body.scrollHeight / 3);
        setTimeout(() => window.scrollTo(0, document.body.scrollHeight / 1.5), 500);
        setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 1000);
      })()`);
    } catch {}

    await new Promise(r => setTimeout(r, 4500));

    try {
      await page.evaluate(`(() => {
        const s = document.querySelector('#nav-review') ||
          document.querySelector('[id*="review"]') ||
          document.querySelector('[class*="review--wrap"]') ||
          document.querySelector('[class*="feedback--wrap"]') ||
          document.querySelector('[class*="evaluation--wrap"]');
        if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo(0, document.body.scrollHeight + 500);
      })()`);
      await new Promise(r => setTimeout(r, 3000));
    } catch {}

    const domData = await page.evaluate(`(() => {
      const text = (sel) => document.querySelector(sel)?.textContent?.trim() || null;
      const specs = {};
      document.querySelectorAll('[class*="specification--prop"]').forEach(el => {
        const k = el.querySelector('[class*="specification--title"]')?.textContent?.trim();
        const v = el.querySelector('[class*="specification--desc"]')?.textContent?.trim() || el.querySelector('[class*="specification--desc"]')?.getAttribute('title')?.trim();
        if (k && v) specs[k] = v;
      });
      if (Object.keys(specs).length === 0) {
        const sl = document.querySelector('#nav-specification ul') || document.querySelector('[class*="specification--list"]');
        if (sl) sl.querySelectorAll('li').forEach(li => {
          const divs = li.querySelectorAll('div');
          for (let i = 0; i < divs.length; i += 2) {
            const k = divs[i]?.textContent?.trim(); const v = divs[i+1]?.textContent?.trim();
            if (k && v) specs[k] = v;
          }
        });
      }
      const images = [];
      const metaImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (metaImage) images.push(metaImage);
      const storeNames = ['.store-detail--storeName--Lk2FVZ4','[class*="store-detail--storeName"]','.store-info--name--E2VWTyv a','[class*="store-info--name"] a','a[data-pl="store-name"]','.store-name'];
      let storeName = null;
      for (const sel of storeNames) { storeName = text(sel); if (storeName) break; }
      const slEl = document.querySelector('a[data-pl="store-name"]') || document.querySelector('[class*="store-info--name"] a') || document.querySelector('.store-header a');
      const storeUrl = slEl ? slEl.getAttribute('href') : null;
      const storeDescText = text('[class*="store-info--desc"]') || text('[class*="store-info--content"]') || '';
      const videoEl = document.querySelector('video');
      const videoUrl = videoEl ? videoEl.getAttribute('src') || videoEl.src : null;
      return { title: text('h1') || text('[class*="title--"]') || document.title, specs, images, storeName, storeUrl, storeDescText, videoUrl };
    })()`) as any;

    result.title = domData.title || undefined;
    result.specs = domData.specs || {};
    result.videoUrl = domData.videoUrl || undefined;
    result.images = domData.images || [];
    if (domData.images?.length) result.mainImage = domData.images[0];
    result.variants = mtopVariants;
    result.skuList = mtopSkuList;
    if (domData.storeName) {
      result.seller = {
        name: domData.storeName,
        storeUrl: domData.storeUrl ? (domData.storeUrl.startsWith('http') ? domData.storeUrl : 'https:' + domData.storeUrl) : undefined,
      };
      if (domData.storeDescText) {
        const rm = domData.storeDescText.match(/(\d+(?:\.\d+)?)\s*%/);
        if (rm) { result.seller.positiveRate = rm[1] + '%'; result.seller.rating = parseFloat(rm[1]) / 20; }
        const fm = domData.storeDescText.match(/(\d[\d\s]*)\s*(?:Obserwujący|Follower)/i);
        if (fm) result.seller.followers = parseInt(fm[1].replace(/\s/g, ''), 10);
      }
    }

    await browser.close();

    if (pcDescUrl) {
      try {
        const descRes = await nodeFetch(pcDescUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        });
        if (descRes.ok) {
          const html = await descRes.text() as string;
          result.descriptionHtml = html;
          const imgMatches = Array.from(html.matchAll(/src=["']([^"']+alicdn\.com[^"']+)["']/gi)) as RegExpMatchArray[];
          result.descriptionImages = [...new Set(imgMatches.map((m: RegExpMatchArray) => normaliseAliExpressImageUrl(m[1])).filter(isValidAliCdnUrl))].slice(0, 10);
          console.log(`[CF Scraper] ✓ desc: ${html.length} chars, ${result.descriptionImages.length} imgs`);
        }
      } catch (e: any) { console.error(`[CF Scraper] desc fetch failed: ${e.message}`); }
    }

    result.reviewImages = Array.from(reviewImageSet).slice(0, 20);
    result.reviews = reviewsList;
    console.log(`[CF Scraper] ✓ Done: reviewImages=${result.reviewImages.length}, descImages=${result.descriptionImages?.length || 0}`);

  } catch (err: any) {
    console.error(`[CF Scraper] Fatal error:`, err.message);
    try { await browser.close(); } catch {}
  }

  return result;
}
