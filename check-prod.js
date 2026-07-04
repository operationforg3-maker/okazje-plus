const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  console.log('Navigating to https://okazjeplus.pl/pl ...');
  await page.goto('https://okazjeplus.pl/pl', { waitUntil: 'networkidle2' });
  
  await page.screenshot({ path: 'prod-screenshot.png' });
  
  console.log('Done.');
  await browser.close();
})();
