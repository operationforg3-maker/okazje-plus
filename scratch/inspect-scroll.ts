import puppeteer from 'puppeteer';
import fs from 'fs';

async function main() {
  const aliId = '1005011915699382';
  const url = `https://pl.aliexpress.com/item/${aliId}.html`;
  console.log(`Launching Puppeteer to fetch and scroll: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('Scrolling down to trigger lazy loading...');
    // Scroll down in increments
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(r => setTimeout(r, 500));
    }

    console.log('Attempting to click "Wyświetl więcej" button...');
    const clicked = await page.evaluate(() => {
      // Find the button with text containing 'Wyświetl więcej' or 'Show more' or class 'extend--btn'
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.includes('Wyświetl więcej') || 
             b.textContent?.includes('Show More') ||
             b.className.includes('extend--btn')
      );
      if (btn) {
        (btn as any).click();
        return true;
      }
      
      // Fallback: look for description wrapper button
      const descEl = document.querySelector('#nav-description');
      if (descEl) {
        const descBtn = descEl.querySelector('button');
        if (descBtn) {
          (descBtn as any).click();
          return true;
        }
      }
      return false;
    });

    console.log(`Clicked button: ${clicked}`);
    
    // Wait for iframe content to load
    console.log('Waiting for content to load...');
    await new Promise(r => setTimeout(r, 4000));

    // Inspect iframe content again
    const iframeContents = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map((iframe, idx) => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          const bodyHtml = doc?.body?.innerHTML || '';
          const bodyText = doc?.body?.innerText || '';
          const src = iframe.getAttribute('src') || iframe.src;
          return {
            idx,
            className: iframe.className,
            src,
            bodyHtmlLength: bodyHtml.length,
            bodyTextLength: bodyText.length,
            bodyHtmlPreview: bodyHtml.slice(0, 500),
          };
        } catch (err: any) {
          return {
            idx,
            className: iframe.className,
            error: err.message
          };
        }
      });
    });

    console.log('Iframe contents after scroll/click:', JSON.stringify(iframeContents, null, 2));

    // Save description iframe HTML if found
    const targetIframe = iframeContents.find(f => f.className?.includes('extend--iframe') && f.bodyHtmlLength && f.bodyHtmlLength > 100);
    if (targetIframe && targetIframe.bodyHtmlPreview) {
      console.log(`Found loaded description iframe with length: ${targetIframe.bodyHtmlLength}`);
      // Let's get the full HTML of that iframe
      const fullHtml = await page.evaluate((idx) => {
        const iframe = document.querySelectorAll('iframe')[idx];
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        return doc?.body?.innerHTML || '';
      }, targetIframe.idx);
      fs.writeFileSync('scratch/desc-iframe-loaded.html', fullHtml);
      console.log('Saved loaded iframe HTML to scratch/desc-iframe-loaded.html');
    } else {
      console.log('Loaded description iframe NOT found.');
    }

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
