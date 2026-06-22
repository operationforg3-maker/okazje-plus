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
    await new Promise(r => setTimeout(r, 3000));

    // Get all frames
    const frames = page.frames();
    console.log(`Total frames found: ${frames.length}`);

    for (let idx = 0; idx < frames.length; idx++) {
      const frame = frames[idx];
      const name = frame.name();
      const frameUrl = frame.url();
      
      try {
        const bodyText = await frame.evaluate(() => document.body?.innerText?.slice(0, 300) || '');
        const hasImages = await frame.evaluate(() => document.querySelectorAll('img').length);
        console.log(`Frame ${idx}: name="${name}" url="${frameUrl}" bodyTextLength=${bodyText.length} imagesCount=${hasImages}`);
        if (bodyText.length > 0) {
          console.log(`  Preview: ${bodyText.replace(/\n/g, ' ').slice(0, 150)}`);
        }
      } catch (err: any) {
        console.log(`  Frame ${idx}: Cannot evaluate (cross-origin or blocked): ${err.message}`);
      }
    }

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
