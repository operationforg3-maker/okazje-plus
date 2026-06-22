import fetch from 'node-fetch';

async function auditUrl(url: string, expectedContent?: string) {
  console.log(`\nAuditing URL: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    
    console.log(`- Status: ${res.status} ${res.statusText}`);
    console.log(`- Content-Type: ${res.headers.get('content-type')}`);
    
    const text = await res.text();
    console.log(`- Length: ${text.length} bytes`);
    
    if (expectedContent) {
      const hasContent = text.includes(expectedContent);
      console.log(`- Contains "${expectedContent}": ${hasContent ? '✅ YES' : '❌ NO'}`);
    }
  } catch (err: any) {
    console.error(`- Error auditing URL: ${err.message || err}`);
  }
}

async function main() {
  console.log('=== STARTING PRODUCTION AUDIT ===');
  
  await auditUrl('https://okazjeplus.pl/pl', 'Okazje+');
  await auditUrl('https://okazjeplus.pl/pl/deals', 'deals');
  await auditUrl('https://okazjeplus.pl/pl/products/01iNf5CJqWCPgo7Hwa3q', 'Okapi');
  await auditUrl('https://okazjeplus.pl/pl/forum', 'forum');
  
  console.log('=== PRODUCTION AUDIT COMPLETED ===');
}

main().catch(console.error);
