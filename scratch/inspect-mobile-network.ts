import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function run() {
  const productId = '1005009279188100';
  const url = `https://pl.aliexpress.com/item/${productId}.html`;
  console.log(`Navigating to mobile layout for: ${url}`);
  
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
  
  try {
    const page = await browser.newPage();
    
    // Set iPhone user agent and viewport
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
    
    await page.evaluateOnNewDocument(() => {
      // Hide webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      // Hide chrome properties
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
      // Overwrite languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['pl-PL', 'pl', 'en-US', 'en'],
      });
    });

    const requests: any[] = [];
    const responses: any[] = [];
    
    page.on('request', request => {
      const reqUrl = request.url();
      if (reqUrl.includes('mtop') || reqUrl.includes('api') || reqUrl.includes('query') || reqUrl.includes('detail')) {
        requests.push({
          url: reqUrl,
          method: request.method(),
          headers: request.headers(),
        });
      }
    });

    page.on('response', async response => {
      const respUrl = response.url();
      if (respUrl.includes('mtop') || respUrl.includes('api') || respUrl.includes('query') || respUrl.includes('detail')) {
        try {
          const text = await response.text();
          responses.push({
            url: respUrl,
            status: response.status(),
            textPreview: text.slice(0, 500)
          });
          
          if (text.includes('sku') || text.includes('price') || text.includes('variant')) {
            console.log(`\nFound target response: ${respUrl}`);
            console.log(`Status: ${response.status()}`);
            console.log(`Preview: ${text.slice(0, 800)}`);
            fs.writeFileSync(`scratch/mobile_response_${Date.now()}.json`, text);
          }
        } catch (e) {}
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    
    // Scroll a bit to trigger lazy loads
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 3);
    });
    await new Promise(r => setTimeout(r, 6000));
    
    console.log(`\nTotal intercepted requests: ${requests.length}`);
    console.log(`Total intercepted responses: ${responses.length}`);
    
    fs.writeFileSync('scratch/mobile_requests.json', JSON.stringify({ requests, responses }, null, 2));
    
  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
