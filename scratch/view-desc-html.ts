import fetch from 'node-fetch';
import { load as loadHtml } from 'cheerio';
import fs from 'fs';

async function main() {
  const productId = '1005010399772854';
  const url = `https://pl.aliexpress.com/desc/common/${productId}.html`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8',
      },
    });
    const html = await res.text();
    fs.writeFileSync('scratch/desc-output.html', html);
    console.log(`Saved html to scratch/desc-output.html`);
    
    const $ = loadHtml(html);
    
    // Find all script tags containing data
    $('script').each((i, el) => {
      const text = $(el).text();
      if (text.includes('runParams') || text.includes('descVal') || text.includes('detailDesc')) {
        console.log(`Script ${i} matches: length ${text.length}`);
        console.log(text.slice(0, 500));
      }
    });

    // Let's print the body outer HTML to see what's in the actual document structure
    console.log(`Body HTML:`, $('body').html()?.slice(0, 1000));
  } catch (err: any) {
    console.error(err);
  }
}

main().catch(console.error);
