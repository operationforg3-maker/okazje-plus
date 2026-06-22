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
    const lines = html.split('\n');
    
    console.log('--- HTML LINES 55 to 90 ---');
    for (let i = 54; i < 90 && i < lines.length; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  } catch (err: any) {
    console.error(err);
  }
}

main();
