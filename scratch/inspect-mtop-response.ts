import puppeteer from 'puppeteer';

async function main() {
  const aliId = '1005011915699382';
  const url = `https://pl.aliexpress.com/item/${aliId}.html`;
  console.log(`Launching Puppeteer to intercept MTOP response: ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1200 });

    let mtopResponse: any = null;

    page.on('response', async response => {
      const respUrl = response.url();
      if (respUrl.includes('mtop.aliexpress.pdp.pc.query')) {
        try {
          let text = await response.text();
          // Strip JSONP wrapper e.g. mtopjsonp1({...})
          text = text.trim();
          const jsonpMatch = text.match(/^\s*\w+\((.*)\)\s*;?\s*$/s);
          if (jsonpMatch) {
            text = jsonpMatch[1];
          }
          mtopResponse = JSON.parse(text);
          console.log(`\nFound MTOP Query Response! Status=${response.status()}`);
        } catch (e: any) {
          console.log('Failed to parse MTOP response:', e.message);
        }
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });

    if (mtopResponse) {
      const data = mtopResponse.data || {};
      console.log('MTOP Data Keys:', Object.keys(data));
      
      // Let's search inside MTOP data recursively for 'description' or 'desc'
      const searchInObj = (obj: any, path: string = ''): string[] => {
        if (!obj || typeof obj !== 'object') return [];
        const found: string[] = [];
        for (const [k, v] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${k}` : k;
          if (k.toLowerCase().includes('desc') || k.toLowerCase().includes('spec') || k === 'key' || k === 'token') {
            found.push(`${currentPath} = ${String(v).slice(0, 150)}`);
          }
          if (typeof v === 'object') {
            found.push(...searchInObj(v, currentPath));
          }
        }
        return found;
      };

      const foundPaths = searchInObj(data);
      console.log('\n--- Found Description/Spec Paths in MTOP Response ---');
      console.log(foundPaths.slice(0, 40).join('\n'));
    } else {
      console.log('MTOP response was not captured!');
    }

  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
