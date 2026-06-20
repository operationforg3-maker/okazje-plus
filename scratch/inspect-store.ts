import puppeteer from 'puppeteer';

async function runFind() {
  const aliId = '1005011915699382';
  const url = `https://pl.aliexpress.com/item/${aliId}.html`;
  console.log(`Inspecting store elements for: ${url}`);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8' });
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2' });

    const results = await page.evaluate(`(() => {
      // Find elements containing 'ZOONLYI'
      const matches = [];
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        if (el.textContent && el.textContent.includes('ZOONLYI') && el.children.length > 0) {
          // Let's only take elements that are close to the target
          if (el.textContent.length < 500) {
            matches.push({
              tagName: el.tagName,
              className: el.className,
              text: el.textContent.trim().replace(/\\s+/g, ' '),
              outerHTML: el.outerHTML.slice(0, 300)
            });
          }
        }
      }
      return matches;
    })()`);

    console.log('--- Matching Elements ---');
    console.log(JSON.stringify(results, null, 2));

  } catch (err: any) {
    console.error('Failed to run find:', err.message);
  } finally {
    await browser.close();
  }
}

runFind();
