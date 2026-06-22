import puppeteer from 'puppeteer';

async function main() {
  const aliId = '1005011915699382';
  const url = `https://pl.aliexpress.com/item/${aliId}.html`;
  console.log(`Launching Puppeteer to fetch: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait a bit to ensure async loading is done
    await new Promise(r => setTimeout(r, 4000));

    const iframeContents = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map((iframe, idx) => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          const bodyHtml = doc?.body?.innerHTML || '';
          const bodyText = doc?.body?.innerText || '';
          return {
            idx,
            className: iframe.className,
            bodyHtmlLength: bodyHtml.length,
            bodyTextLength: bodyText.length,
            bodyTextPreview: bodyText.slice(0, 300),
            bodyHtmlPreview: bodyHtml.slice(0, 300)
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

    console.log('Iframe contents:', JSON.stringify(iframeContents, null, 2));

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
