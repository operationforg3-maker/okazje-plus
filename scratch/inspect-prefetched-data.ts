import puppeteer from 'puppeteer';

async function main() {
  const aliId = '1005011915699382';
  const url = `https://pl.aliexpress.com/item/${aliId}.html`;
  console.log(`Launching Puppeteer to search window variables: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Search window object properties for target substring
    const foundPaths = await page.evaluate(() => {
      const paths: string[] = [];
      const visited = new Set();
      
      const search = (obj: any, path: string = '', depth: number = 0) => {
        if (depth > 6) return;
        if (!obj || typeof obj !== 'object') return;
        if (visited.has(obj)) return;
        visited.add(obj);

        for (const key of Object.getOwnPropertyNames(obj)) {
          try {
            const v = obj[key];
            const currentPath = path ? `${path}.${key}` : key;
            if (typeof v === 'string') {
              if (v.includes('pdp.aliexpress-media.com') || v.includes('desc.htm')) {
                paths.push(`${currentPath} = ${v.slice(0, 150)}`);
              }
            } else if (typeof v === 'object' && v !== null) {
              search(v, currentPath, depth + 1);
            }
          } catch (e) {
            // Ignore property access errors
          }
        }
      };

      // Search common globals
      search(window, '', 0);
      return paths;
    });

    console.log('\n--- Found Paths in Window Object ---');
    console.log(foundPaths.join('\n'));

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
