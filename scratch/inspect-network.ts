import puppeteer from 'puppeteer';

async function main() {
  const aliId = '1005011915699382';
  const url = `https://pl.aliexpress.com/item/${aliId}.html`;
  console.log(`Launching Puppeteer to intercept network: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    // Enable request interception
    await page.setRequestInterception(false); // We don't want to modify requests, just listen

    const requests: any[] = [];
    page.on('request', request => {
      const type = request.resourceType();
      const reqUrl = request.url();
      if (type === 'xhr' || type === 'fetch' || reqUrl.includes('api') || reqUrl.includes('desc')) {
        requests.push({
          type,
          url: reqUrl,
          method: request.method()
        });
      }
    });

    page.on('response', async response => {
      const respUrl = response.url();
      if (respUrl.includes('api') || respUrl.includes('desc') || respUrl.includes('product') || respUrl.includes('specification')) {
        try {
          const status = response.status();
          const contentType = response.headers()['content-type'] || '';
          if (status === 200 && (contentType.includes('json') || contentType.includes('javascript') || contentType.includes('html'))) {
            // We just log it for now
            console.log(`Response: status=${status} url=${respUrl.slice(0, 150)} type=${contentType}`);
          }
        } catch {}
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });

    console.log('Scrolling down to trigger lazy requests...');
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log('\n--- Intercepted XHR/Fetch/API Requests ---');
    console.log(JSON.stringify(requests.slice(0, 30), null, 2));

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
