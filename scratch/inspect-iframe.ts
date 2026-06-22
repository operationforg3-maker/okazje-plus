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
    await page.setViewport({ width: 1280, height: 1000 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Let's print iframe attributes under the description section
    const iframeData = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map((iframe, i) => {
        const src = iframe.getAttribute('src') || iframe.getAttribute('data-src') || iframe.src;
        const className = iframe.className;
        const id = iframe.id;
        const outerHTML = iframe.outerHTML.slice(0, 500);
        return { i, id, className, src, outerHTML };
      });
    });

    console.log('Iframes found:', JSON.stringify(iframeData, null, 2));

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
