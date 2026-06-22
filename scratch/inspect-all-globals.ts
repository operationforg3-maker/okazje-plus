import puppeteer from 'puppeteer';
import fs from 'fs';

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

    const configs = await page.evaluate(() => {
      return {
        _page_config_: (window as any)._page_config_ ? JSON.stringify((window as any)._page_config_).slice(0, 2000) : null,
        _dida_config_: (window as any)._dida_config_ ? JSON.stringify((window as any)._dida_config_).slice(0, 2000) : null,
        _initialData_: (window as any)._initialData_ ? JSON.stringify((window as any)._initialData_).slice(0, 2000) : null,
        __INITIAL_STATE__: (window as any).__INITIAL_STATE__ ? JSON.stringify((window as any).__INITIAL_STATE__).slice(0, 2000) : null,
      };
    });

    console.log('Configs found:');
    console.log(JSON.stringify(configs, null, 2));

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
