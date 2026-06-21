import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

export interface ScrapedAliExpressData {
  title?: string;
  descriptionHtml?: string;
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
}

/**
 * Scrapes detailed product information from AliExpress (including specifications and description HTML)
 * by rendering the page in Puppeteer and intercepting dynamic content.
 * 
 * @param productId AliExpress product ID
 */
export async function scrapeAliExpressProduct(productId: string): Promise<ScrapedAliExpressData> {
  const url = `https://pl.aliexpress.com/item/${productId}.html`;
  console.log(`[AliExpress Scraper] Launching Puppeteer for item: ${productId}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const result: ScrapedAliExpressData = {
    specs: {},
    images: []
  };

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8'
    });
    await page.setViewport({ width: 1280, height: 1000 });

    let pcDescUrl = '';

    // Listen to network responses to extract the description CDN URL from MTOP response
    page.on('response', async (response) => {
      const respUrl = response.url();
      if (respUrl.includes('mtop.aliexpress.pdp.pc.query')) {
        try {
          let text = await response.text();
          text = text.trim();
          // Handle JSONP wrapper if present
          const jsonpMatch = text.match(/^\s*\w+\(([\s\S]*)\)\s*;?\s*$/);
          if (jsonpMatch) {
            text = jsonpMatch[1];
          }
          const mtopJson = JSON.parse(text);
          const descConfig = mtopJson?.data?.result?.DESC || mtopJson?.result?.DESC;
          if (descConfig?.pcDescUrl) {
            pcDescUrl = descConfig.pcDescUrl;
            console.log(`[AliExpress Scraper] Found pcDescUrl: ${pcDescUrl.slice(0, 100)}...`);
          }
        } catch (e: any) {
          console.warn(`[AliExpress Scraper] Response read error for ${respUrl.slice(0, 80)}: ${e.message}`);
        }
      }
    });

    console.log(`[AliExpress Scraper] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

    // Scroll to trigger lazy loading of description and specs
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

    // Wait for dynamic content
    await new Promise(r => setTimeout(r, 3000));

    // Try to auto-click "Zobacz więcej" / "Show more" button in specifications to render all specs
    try {
      await page.evaluate(`(() => {
        const specSection = document.querySelector('#nav-specification') || document.querySelector('[class*="specification--"]');
        if (specSection) {
          const btn = specSection.querySelector('button') || Array.from(specSection.querySelectorAll('div')).find(
            d => d.textContent?.includes('Zobacz więcej') || d.textContent?.includes('Show More')
          );
          if (btn) (btn as any).click();
        }
      })()`);
      await new Promise(r => setTimeout(r, 500));
    } catch (btnErr) {
      // Ignored
    }

    // Extract specs and basic metadata from DOM using string evaluation to avoid esbuild __name helpers
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

      // If specifications wrapper exists but has different structure
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
      const h1Title = text('h1');
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

    // Step 2: Fetch the description HTML block directly from CDN using intercepted pcDescUrl
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
          result.descriptionHtml = await descRes.text();
          console.log(`[AliExpress Scraper] ✓ Description HTML successfully fetched (${result.descriptionHtml.length} chars)`);
        } else {
          console.error(`[AliExpress Scraper] Description CDN fetch returned status: ${descRes.status}`);
        }
      } catch (descErr: any) {
        console.error(`[AliExpress Scraper] Failed to fetch description from CDN: ${descErr.message}`);
      }
    }

  } catch (err: any) {
    console.error(`[AliExpress Scraper] Scraping process encountered an error:`, err.message);
    try {
      await browser.close();
    } catch {}
  }

  return result;
}
