import puppeteer from 'puppeteer';
import fs from 'fs';

async function main() {
  const aliId = '1005011915699382';
  const url = `https://pl.aliexpress.com/item/${aliId}.html`;
  console.log(`Fetching page with Puppeteer: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8'
    });
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Handle cookie consent (if present)
    try {
      await page.evaluate(() => {
        const acceptBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Accept') || b.textContent?.includes('Akceptuję'));
        if (acceptBtn) (acceptBtn as any).click();
      });
      await new Promise(r => setTimeout(r, 1000));
    } catch {}

    // Find and click specifications expand button if exists
    try {
      await page.evaluate(() => {
        // Try finding any expand button under specification section
        const specSection = document.querySelector('#nav-specification') || document.querySelector('[class*="specification--"]');
        if (specSection) {
          const btn = specSection.querySelector('button') || Array.from(specSection.querySelectorAll('div')).find(d => d.textContent?.includes('Zobacz więcej') || d.textContent?.includes('Show More'));
          if (btn) (btn as any).click();
        }
      });
      await new Promise(r => setTimeout(r, 1000));
    } catch {}

    // Get specifications and description HTML blocks
    const results = await page.evaluate(() => {
      const specEl = document.querySelector('#nav-specification') || document.querySelector('[class*="specification--"]');
      const descEl = document.querySelector('#nav-description') || document.querySelector('[class*="description--"]');
      
      return {
        specHtml: specEl ? specEl.outerHTML : null,
        descHtml: descEl ? descEl.outerHTML : null,
        specText: specEl ? (specEl as HTMLElement).innerText : null,
      };
    });

    console.log('Got HTML content.');
    if (results.specHtml) {
      fs.writeFileSync('scratch/specs-dom.html', results.specHtml);
      console.log('Saved specs HTML to scratch/specs-dom.html');
      console.log('Specs Text Preview:\n', results.specText?.slice(0, 1000));
    } else {
      console.log('Specs HTML element not found!');
    }

    if (results.descHtml) {
      fs.writeFileSync('scratch/desc-dom.html', results.descHtml);
      console.log('Saved desc HTML to scratch/desc-dom.html');
    } else {
      console.log('Description HTML element not found!');
    }

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
