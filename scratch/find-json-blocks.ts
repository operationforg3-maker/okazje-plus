import fetch from 'node-fetch';

async function main() {
  const productId = '1005010399772854';
  const url = `https://pl.aliexpress.com/item/${productId}.html`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  };

  try {
    const res = await fetch(url, { headers });
    const html = await res.text();

    console.log('Searching HTML for e-commerce keys...');
    
    // We can search for where specs are mentioned
    // Let's search for "attributes" or "specs" or "specification" or "properties"
    const searchKeys = ['attributes', 'specs', 'specification', 'detailDesc', 'description', 'runParams', 'initialData', '_page_config_'];
    for (const key of searchKeys) {
      const idx = html.indexOf(key);
      if (idx !== -1) {
        console.log(`Found key "${key}" at position ${idx}. Context: ${html.slice(idx - 50, idx + 150)}`);
      } else {
        console.log(`Key "${key}" NOT found.`);
      }
    }

    // Let's find all script tags and look at those containing data
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(html)) !== null) {
      count++;
      const scriptContent = match[1];
      if (scriptContent.length > 500) {
        console.log(`Script tag #${count} (length: ${scriptContent.length}):`);
        // Check if there is JSON inside
        if (scriptContent.includes('window._page_config_')) {
          console.log(`  - contains window._page_config_`);
        }
        if (scriptContent.includes('runParams')) {
          console.log(`  - contains runParams`);
        }
        // Print first 200 and last 200 chars of the script block
        console.log(`  - Start: ${scriptContent.slice(0, 200).replace(/\s+/g, ' ')}`);
        // If it looks like a large JSON or configuration, let's print where it might contain data
        if (scriptContent.includes('detailDesc') || scriptContent.includes('productInfo') || scriptContent.includes('specifications')) {
          console.log(`  - SUCCESS: contains product detail keys!`);
          console.log(`    Context: ${scriptContent.slice(scriptContent.indexOf('detailDesc') - 100, scriptContent.indexOf('detailDesc') + 200).replace(/\s+/g, ' ')}`);
        }
      }
    }
  } catch (err: any) {
    console.error(err);
  }
}

main();
