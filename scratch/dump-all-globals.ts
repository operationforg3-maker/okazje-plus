import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function run() {
  const productId = '1005009279188100';
  const url = `https://pl.aliexpress.com/item/${productId}.html`;
  console.log(`Navigating to: ${url}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8'
    });
    await page.setViewport({ width: 1280, height: 1000 });
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    
    // Dump some global variables that might contain the product details JSON
    const data = await page.evaluate(() => {
      const result: Record<string, any> = {};
      
      // Let's try to extract _page_config_
      if ((window as any)._page_config_) {
        result._page_config_ = (window as any)._page_config_;
      }
      
      // Let's find any script tag containing "runParams" and search for details
      const scriptTags = Array.from(document.querySelectorAll('script'));
      const textScripts = scriptTags.map(s => s.textContent || '').filter(t => t.includes('runParams') || t.includes('window._d_c_'));
      
      result.textScriptsCount = textScripts.length;
      result.textScriptsLengths = textScripts.map(t => t.length);
      
      // Look for runParams variables inside scripts
      // AliExpress often stores the product details in window.runParams = {...} inside a script tag
      // Let's extract all matches of window.runParams = { ... } or window._initData = { ... } or window._d_c_.DCData = { ... }
      return result;
    });
    
    console.log('Evaluated data:', JSON.stringify(data, null, 2));
    
    // Let's find all script tags in the page HTML and search for the one containing details.
    const html = await page.content();
    fs.writeFileSync('scratch/page_source.html', html);
    console.log('Saved full page source to scratch/page_source.html');
    
    // Search for pattern "runParams" in page HTML
    const lines = html.split('\n');
    const runParamsLines = lines.filter(l => l.includes('runParams'));
    console.log(`Found ${runParamsLines.length} lines containing runParams.`);
    runParamsLines.forEach((l, idx) => {
      console.log(`Line ${idx}: ${l.substring(0, 200)}...`);
    });
    
  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

run();
