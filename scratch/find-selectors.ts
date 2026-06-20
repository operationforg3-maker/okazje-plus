import puppeteer from 'puppeteer';

async function runFind() {
  const aliId = '1005011915699382';
  const url = `https://pl.aliexpress.com/item/${aliId}.html`;
  console.log(`Searching selectors for store trust indicators...`);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8' });
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: 'networkidle2' });

    const results = await page.evaluate(`(() => {
      const findTextInElements = (pattern) => {
        const matches = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
          const parent = node.parentElement;
          if (!parent) continue;
          const parentTag = parent.tagName.toUpperCase();
          if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'NOSCRIPT') {
            continue;
          }
          if (node.textContent && node.textContent.includes(pattern)) {
            matches.push({
              text: node.textContent.trim(),
              tagName: parent.tagName,
              className: parent.className,
              outerHTML: parent.outerHTML.slice(0, 250)
            });
          }
        }
        return matches;
      };

      return {
        opinions: findTextInElements('opinie'),
        followers: findTextInElements('Obserwujący')
      };
    })()`);

    console.log('--- Opinions Elements ---');
    console.log(JSON.stringify(results.opinions, null, 2));

    console.log('\n--- Followers Elements ---');
    console.log(JSON.stringify(results.followers, null, 2));

  } catch (err: any) {
    console.error('Failed to run find:', err.message);
  } finally {
    await browser.close();
  }
}

runFind();
