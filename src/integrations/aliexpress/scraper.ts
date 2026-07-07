import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

/**
 * A single customer review with optional photos (scraped from MTOP feedback endpoint).
 */
export interface ScrapedReview {
  rating: number;
  content?: string;
  translatedContent?: string;
  images: string[];
  country?: string;
  date?: string;
  /** SKU info string, e.g. "Color:Black;Size:M" */
  skuInfo?: string;
}

export interface ScrapedAliExpressData {
  title?: string;
  descriptionHtml?: string;
  /** Image URLs extracted from the description HTML block (CDN) */
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
  variants?: Array<{
    id: string;
    name: string;
    values: string[];
  }>;
  skuList?: Array<{
    skuId: string;
    available: boolean;
    attributes: Array<{ name: string; value: string; image?: string }>;
    price?: number;
    stock?: number;
    image?: string;
  }>;
  /** Deduplicated list of customer-uploaded review photo URLs (max 20) */
  reviewImages?: string[];
  /** Structured review data — only entries that have images (max 10) */
  reviews?: ScrapedReview[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Normalise a raw image URL from AliExpress CDN */
function normaliseAliExpressImageUrl(url: string): string {
  if (!url) return '';
  // Prepend protocol for protocol-relative URLs
  if (url.startsWith('//')) url = `https:${url}`;
  // Strip AliExpress inline resize suffix (e.g. _50x50.jpg, _100x100.webp)
  url = url.replace(/(_\d+x\d+)\.(jpg|webp|png)$/i, '.$2');
  return url;
}

/** Returns true when a URL looks like an AliExpress CDN image we want to keep */
function isValidAliCdnUrl(url: string): boolean {
  return (
    url.startsWith('https://') &&
    (url.includes('alicdn.com') || url.includes('aliexpress-media.com'))
  );
}

/**
 * Extract all image URLs from a raw MTOP feedback/evaluation item.
 * Handles three known field shapes: images[], imageList[{imgUrl}], imagePathList[].
 */
function extractReviewImages(reviewItem: any): string[] {
  const raw: string[] = [];

  // Format 1: images as string[]
  if (Array.isArray(reviewItem.images)) {
    for (const u of reviewItem.images) {
      if (typeof u === 'string') raw.push(u);
    }
  }
  // Format 2: imageList as { imgUrl: string }[]
  if (Array.isArray(reviewItem.imageList)) {
    for (const img of reviewItem.imageList) {
      const u = img?.imgUrl || img?.url || img;
      if (typeof u === 'string') raw.push(u);
    }
  }
  // Format 3: imagePathList as string[]
  if (Array.isArray(reviewItem.imagePathList)) {
    for (const u of reviewItem.imagePathList) {
      if (typeof u === 'string') raw.push(u);
    }
  }

  return raw
    .map(normaliseAliExpressImageUrl)
    .filter(isValidAliCdnUrl);
}

/**
 * Returns true for any MTOP URL that may carry customer review/feedback data.
 * AliExpress uses several different endpoint names depending on region and A/B tests.
 */
function isFeedbackUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    (lower.includes('aliexpress') || lower.includes('aeserver')) &&
    (
      lower.includes('feedback') ||
      lower.includes('evaluation') ||
      lower.includes('evalist') ||
      lower.includes('review')
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scrapes detailed product information from AliExpress (including specifications,
 * description HTML, variants, and customer review images) by rendering the page
 * in Puppeteer (mobile UA) and intercepting dynamic MTOP XHR/fetch responses.
 *
 * @param productId AliExpress product ID
 */
export async function scrapeAliExpressProduct(productId: string): Promise<ScrapedAliExpressData> {
  const url = `https://pl.aliexpress.com/item/${productId}.html`;
  console.log(`[AliExpress Scraper] Launching Puppeteer for item (mobile UA): ${productId}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const result: ScrapedAliExpressData = {
    specs: {},
    images: [],
    variants: [],
    skuList: [],
    reviewImages: [],
    reviews: [],
    descriptionImages: [],
  };

  try {
    const page = await browser.newPage();
    
    // Set mobile user agent and viewport to load H5/mobile layout which is less protected by captcha
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8'
    });
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });

    // Inject webdriver overrides
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      Object.defineProperty(navigator, 'languages', {
        get: () => ['pl-PL', 'pl', 'en-US', 'en'],
      });
    });

    let pcDescUrl = '';
    let mtopVariants: any[] = [];
    let mtopSkuList: any[] = [];

    // Accumulated review data from MTOP feedback intercepts
    const reviewImageSet = new Set<string>();
    const reviewsList: ScrapedReview[] = [];

    // Listen to network responses to extract variants, description CDN URL, and review images
    page.on('response', async (response) => {
      const respUrl = response.url();

      // ── 1. Product detail (variants, SKU, shipping, desc URL) ─────────────
      if (respUrl.includes('mtop.aliexpress.pdp.msite.query')) {
        try {
          const buffer = await response.buffer();
          let text = buffer.toString('utf-8');
          text = text.trim();
          
          // Handle JSONP wrapper if present
          const jsonpMatch = text.match(/^\s*\w+\(([\s\S]*)\)\s*;?\s*$/);
          if (jsonpMatch) {
            text = jsonpMatch[1].trim();
          }
          
          const mtopJson = JSON.parse(text);
          const resObj = mtopJson?.data?.result || mtopJson?.result || mtopJson;
          
          if (resObj) {
            // 1. Extract pcDescUrl for description HTML block
            const descConfig = resObj.DESC;
            if (descConfig?.pcDescUrl || descConfig?.msiteDescUrl) {
              pcDescUrl = descConfig.pcDescUrl || descConfig.msiteDescUrl;
              console.log(`[AliExpress Scraper] Found descUrl from mobile MTOP: ${pcDescUrl.slice(0, 100)}...`);
            }

            // 2. Extract variants properties (e.g. Color, Size)
            const rawProperties = resObj.SKU?.skuProperties || [];
            mtopVariants = rawProperties.map((prop: any) => ({
              id: String(prop.skuPropertyId),
              name: prop.skuPropertyName,
              values: prop.skuPropertyValues?.map((val: any) => val.propertyValueName) || [],
            }));

            // 2.5 Extract shipping cost and delivery days
            const shippingLayoutList = resObj.SHIPPING?.deliveryLayoutInfo || resObj.SHIPPING?.originalLayoutResultList;
            if (Array.isArray(shippingLayoutList) && shippingLayoutList.length > 0) {
              let cheapestCost = Infinity;
              let cheapestDays = 7;
              
              for (const option of shippingLayoutList) {
                const bizData = option.bizData;
                if (!bizData) continue;
                
                const amount = bizData.displayAmount !== undefined
                  ? Number(bizData.displayAmount)
                  : (bizData.shippingFee === 'free' ? 0 : parseFloat(String(bizData.formattedAmount || '0').replace(',', '.')));
                
                if (Number.isFinite(amount) && amount < cheapestCost) {
                  cheapestCost = amount;
                  cheapestDays = Number(bizData.deliveryDayMax || bizData.deliveryDayMin || 7);
                }
              }
              
              if (cheapestCost !== Infinity) {
                result.shippingCost = cheapestCost;
                result.shippingDays = cheapestDays;
                console.log(`[AliExpress Scraper] Extracted shipping cost from MTOP: ${cheapestCost} PLN, days: ${cheapestDays}`);
              }
            }

            // 3. Extract concrete SKU list mapping combinations to specific SKU properties
            const skuPaths = resObj.SKU?.skuPaths || [];
            const skuPriceInfoMap = resObj.PRICE?.skuPriceInfoMap || {};
            const skuImagesMap = resObj.HEADER_IMAGE_PC?.skuImagesMap || {};
            const skuQuantityMap = resObj.QUANTITY_PC?.allSkuQuantityView || {};

            // Build helper maps for fast property name lookup
            const valueIdToNameMap = new Map<string, string>();
            const valueIdToImageMap = new Map<string, string>();
            rawProperties.forEach((prop: any) => {
              prop.skuPropertyValues?.forEach((val: any) => {
                valueIdToNameMap.set(String(val.propertyValueId), val.propertyValueName);
                if (val.skuPropertyImagePath) {
                  valueIdToImageMap.set(String(val.propertyValueId), val.skuPropertyImagePath);
                }
              });
            });

            mtopSkuList = skuPaths.map((pathEntry: any) => {
              const skuId = String(pathEntry.skuIdStr || pathEntry.skuId);
              const stock = pathEntry.skuStock ?? 0;
              const available = pathEntry.salable !== false && stock > 0;

              const attributes: Array<{ name: string; value: string; image?: string }> = [];
              const pathString = pathEntry.path || '';
              const segments = pathString.split(';');

              segments.forEach((seg: string) => {
                const [propId, valId] = seg.split(':');
                if (propId && valId) {
                  const prop = rawProperties.find((p: any) => String(p.skuPropertyId) === propId);
                  const propName = prop ? prop.skuPropertyName : `Prop_${propId}`;
                  const valName = valueIdToNameMap.get(valId) || `Val_${valId}`;
                  const valImage = valueIdToImageMap.get(valId);

                  attributes.push({
                    name: propName,
                    value: valName,
                    ...(valImage ? { image: valImage } : {}),
                  });
                }
              });

              // Parse price from salePriceLocal (e.g., "490,85zł|490|85")
              const priceInfo = skuPriceInfoMap[skuId];
              let price: number | undefined;
              if (priceInfo?.salePriceLocal) {
                const parts = priceInfo.salePriceLocal.split('|');
                if (parts.length >= 3) {
                  price = Number(parts[1] + '.' + parts[2]);
                }
              }

              // Extract image from skuImagesMap
              const imageList = skuImagesMap[skuId];
              const image = (Array.isArray(imageList) && imageList.length > 0) ? imageList[0] : undefined;

              return {
                skuId,
                available,
                attributes,
                price,
                stock,
                image
              };
            });

            console.log(`[AliExpress Scraper] Captured ${mtopVariants.length} variants & ${mtopSkuList.length} SKUs from MTOP`);
          }
        } catch (e: any) {
          console.warn(`[AliExpress Scraper] Response read error for ${respUrl.slice(0, 80)}: ${e.message}`);
        }
      }

      // ── 2. Customer review / feedback images ────────────────────────────────
      if (isFeedbackUrl(respUrl)) {
        try {
          const buffer = await response.buffer();
          let text = buffer.toString('utf-8').trim();

          // Unwrap JSONP if present
          const jsonpMatch = text.match(/^\s*\w+\(([\s\S]*)\)\s*;?\s*$/);
          if (jsonpMatch) text = jsonpMatch[1].trim();

          const feedbackJson = JSON.parse(text);

          // Try multiple known response shapes
          const evaList: any[] =
            feedbackJson?.data?.evaListResult?.evaList ||
            feedbackJson?.data?.result?.feedbackList ||
            feedbackJson?.result?.evaList ||
            feedbackJson?.data?.feedbackList ||
            [];

          let newImagesThisResponse = 0;

          for (const review of evaList) {
            const imgs = extractReviewImages(review);
            if (imgs.length === 0) continue;

            imgs.forEach(u => reviewImageSet.add(u));
            newImagesThisResponse += imgs.length;

            // Store structured review data (only entries that have images)
            if (reviewsList.length < 10) {
              reviewsList.push({
                rating: Number(review.star ?? review.rating ?? 5),
                content: review.content || review.buyerFeedback || undefined,
                translatedContent: review.buyerTranslationFeedback || review.translatedContent || undefined,
                images: imgs,
                country: review.buyerCountry || review.country || undefined,
                date: review.feedbackDate || review.date || undefined,
                skuInfo: review.skuInfo || review.skuProperties || undefined,
              });
            }
          }

          if (newImagesThisResponse > 0) {
            console.log(`[AliExpress Scraper] Review images captured: +${newImagesThisResponse} (total: ${reviewImageSet.size})`);
          }
        } catch {
          // Non-JSON or unrelated endpoint — silently skip
        }
      }
    });

    console.log(`[AliExpress Scraper] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

    // ── Phase A: scroll to trigger lazy loading of description and specs ─────
    try {
      await page.evaluate(`(() => {
        window.scrollTo(0, document.body.scrollHeight / 3);
        setTimeout(() => {
          window.scrollTo(0, document.body.scrollHeight / 1.5);
        }, 500);
        setTimeout(() => {
          window.scrollTo(0, document.body.scrollHeight);
        }, 1000);
      })()`);
    } catch (scrollErr) {}

    // Wait for product MTOP response + lazy content
    await new Promise(r => setTimeout(r, 4500));

    // ── Phase B: scroll to the review section to trigger MTOP feedback call ───
    try {
      await page.evaluate(`(() => {
        // Try known selectors for the review/feedback section
        const reviewSection =
          document.querySelector('#nav-review') ||
          document.querySelector('[id*="review"]') ||
          document.querySelector('[class*="review--wrap"]') ||
          document.querySelector('[class*="feedback--wrap"]') ||
          document.querySelector('[class*="evaluation--wrap"]');

        if (reviewSection) {
          reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Fallback: scroll past bottom to trigger any remaining lazy requests
          window.scrollTo(0, document.body.scrollHeight + 500);
        }
      })()`);

      // Give the MTOP feedback request time to fire and respond
      await new Promise(r => setTimeout(r, 3000));
    } catch (reviewScrollErr) {
      console.warn('[AliExpress Scraper] Review section scroll failed:', reviewScrollErr);
    }

    // Evaluate basic specifications from DOM as fallback
    const domData = await page.evaluate(`(() => {
      const text = (sel) => document.querySelector(sel)?.textContent?.trim() || null;

      // Extract specifications (key-value parameters)
      const specs = {};
      const specProps = document.querySelectorAll('[class*="specification--prop"]');
      specProps.forEach(el => {
        const keyEl = el.querySelector('[class*="specification--title"]');
        const valEl = el.querySelector('[class*="specification--desc"]');
        const key = keyEl?.textContent?.trim();
        const val = valEl?.textContent?.trim() || valEl?.getAttribute('title')?.trim();
        if (key && val) {
          specs[key] = val;
        }
      });

      // Alternate structure
      if (Object.keys(specs).length === 0) {
        const specList = document.querySelector('#nav-specification ul') || document.querySelector('[class*="specification--list"]');
        if (specList) {
          const lines = specList.querySelectorAll('li');
          lines.forEach(li => {
            const divs = li.querySelectorAll('div');
            if (divs.length >= 2) {
              for (let i = 0; i < divs.length; i += 2) {
                const key = divs[i]?.textContent?.trim();
                const val = divs[i+1]?.textContent?.trim();
                if (key && val) {
                  specs[key] = val;
                }
              }
            }
          });
        }
      }

      // Title
      const h1Title = text('h1') || text('[class*="title--"]');
      const docTitle = document.title || '';

      // Video
      const videoEl = document.querySelector('video');
      const videoUrl = videoEl ? videoEl.getAttribute('src') || videoEl.src : null;

      // Images
      const images = [];
      const metaImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (metaImage) images.push(metaImage);

      // Store Details
      const storeNameSelectors = [
        '.store-detail--storeName--Lk2FVZ4',
        '[class*="store-detail--storeName"]',
        '.store-info--name--E2VWTyv a',
        '[class*="store-info--name"] a',
        'a[data-pl="store-name"]',
        '.store-name'
      ];
      let storeName = null;
      for (const sel of storeNameSelectors) {
        storeName = text(sel);
        if (storeName) break;
      }

      const storeLinkEl = document.querySelector('a[data-pl="store-name"]') || document.querySelector('[class*="store-info--name"] a') || document.querySelector('.store-header a');
      const storeUrl = storeLinkEl ? storeLinkEl.getAttribute('href') : null;
      const storeDescText = text('[class*="store-info--desc"]') || text('[class*="store-info--content"]') || '';

      return {
        title: h1Title || docTitle,
        specs,
        videoUrl,
        images,
        storeName,
        storeUrl,
        storeDescText
      };
    })()`) as any;

    result.title = domData.title || undefined;
    result.specs = domData.specs || {};
    result.videoUrl = domData.videoUrl || undefined;
    result.images = domData.images || [];
    if (domData.images?.length) {
      result.mainImage = domData.images[0];
    }
    
    // Set variants and skuList from MTOP parser
    result.variants = mtopVariants;
    result.skuList = mtopSkuList;

    if (domData.storeName) {
      result.seller = {
        name: domData.storeName,
        storeUrl: domData.storeUrl ? (domData.storeUrl.startsWith('http') ? domData.storeUrl : 'https:' + domData.storeUrl) : undefined,
      };
      if (domData.storeDescText) {
        const ratingMatch = domData.storeDescText.match(/(\d+(?:\.\d+)?)\s*%/);
        if (ratingMatch) {
          result.seller.positiveRate = ratingMatch[1] + '%';
          result.seller.rating = parseFloat(ratingMatch[1]) / 20;
        }
        const followersMatch = domData.storeDescText.match(/(\d[\d\s]*)\s*(?:Obserwujący|Follower)/i);
        if (followersMatch) {
          result.seller.followers = parseInt(followersMatch[1].replace(/\s/g, ''), 10);
        }
      }
    }

    // Try to get fallback brand/model from JSON-LD if DOM specs didn't extract them
    if (!result.specs.brand || !result.specs.model) {
      const ldSpecs = await page.evaluate(`(() => {
        let brand = null;
        let sku = null;
        let mpn = null;
        let model = null;
        const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const s of ldScripts) {
          try {
            const parsed = JSON.parse(s.textContent || '');
            const candidates = Array.isArray(parsed) ? parsed : [parsed];
            for (const entry of candidates) {
              const product = entry?.['@type'] === 'Product'
                ? entry
                : entry?.['@graph']?.find((item) => item?.['@type'] === 'Product');
              if (product) {
                brand = typeof product.brand === 'string' ? product.brand : product.brand?.name;
                sku = product.sku;
                mpn = product.mpn;
                model = product.model;
              }
            }
          } catch (e) {}
        }
        return { brand, sku, mpn, model };
      })()`) as any;

      if (ldSpecs.brand && !result.specs.brand) result.specs.brand = ldSpecs.brand;
      if (ldSpecs.sku && !result.specs.sku) result.specs.sku = ldSpecs.sku;
      if (ldSpecs.mpn && !result.specs.mpn) result.specs.mpn = ldSpecs.mpn;
      if (ldSpecs.model && !result.specs.model) result.specs.model = ldSpecs.model;
    }

    await browser.close();

    // ── Phase E: Fetch description HTML + extract its embedded images ──────────
    if (pcDescUrl) {
      try {
        console.log(`[AliExpress Scraper] Fetching description HTML from CDN URL...`);
        const descRes = await fetch(pcDescUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          },
          timeout: 10000
        } as any);
        if (descRes.ok) {
          const html = await descRes.text();
          result.descriptionHtml = html;
          console.log(`[AliExpress Scraper] ✓ Description HTML fetched (${html.length} chars)`);

          // Extract image URLs embedded in the description HTML
          const imgMatches = Array.from(html.matchAll(/src=["']([^"']+alicdn\.com[^"']+)["']/gi));
          const descImages = imgMatches
            .map(m => normaliseAliExpressImageUrl(m[1]))
            .filter(isValidAliCdnUrl);

          result.descriptionImages = [...new Set(descImages)].slice(0, 10);
          if (result.descriptionImages.length > 0) {
            console.log(`[AliExpress Scraper] ✓ Description images extracted: ${result.descriptionImages.length}`);
          }
        } else {
          console.error(`[AliExpress Scraper] Description CDN fetch returned status: ${descRes.status}`);
        }
      } catch (descErr: any) {
        console.error(`[AliExpress Scraper] Failed to fetch description from CDN: ${descErr.message}`);
      }
    }

    // ── Phase F: Populate review image results ─────────────────────────────────
    result.reviewImages = Array.from(reviewImageSet).slice(0, 20);
    result.reviews = reviewsList;

    if (result.reviewImages.length > 0) {
      console.log(`[AliExpress Scraper] ✓ Total review images: ${result.reviewImages.length}`);
    }

  } catch (err: any) {
    console.error(`[AliExpress Scraper] Scraping process encountered an error:`, err.message);
    try {
      await browser.close();
    } catch {}
  }

  return result;
}
