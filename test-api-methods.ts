import { config } from 'dotenv';
config({ path: '.env.local' });
import { createHash } from 'crypto';

const APP_KEY = process.env.ALIEXPRESS_APP_KEY!;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET!;

// Test różnych metod API
const methods = [
  'aliexpress.affiliate.product.query',
  'aliexpress.affiliate.productdetail.get',
  'aliexpress.affiliate.hotproduct.query',
  'portals.ds.product.get',
  'taobao.tbk.item.info.get',
];

async function testMethod(method: string) {
  console.log(`\n=== Testing ${method} ===`);
  
  // Build timestamp GMT+8
  const now = new Date();
  const timestampUTC8 = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const timestamp = timestampUTC8.toISOString().replace('T', ' ').substring(0, 19);
  
  const params: Record<string, any> = {
    method,
    app_key: APP_KEY,
    timestamp: timestamp,
    format: 'json',
    v: '2.0',
    simplify: 'true',
  };
  
  // Add method-specific params
  if (method.includes('product.query') || method.includes('hotproduct')) {
    params.keywords = 'phone';
    params.page_no = 1;
    params.page_size = 1;
    params.target_currency = 'PLN';
    params.tracking_id = 'okazjaplus_1';
  }
  
  // Generate signature
  const paramsForSigning = Object.entries(params)
    .filter(([key]) => key !== 'sign')
    .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});
  
  const sortedKeys = Object.keys(paramsForSigning).sort();
  let signString = APP_SECRET;
  for (const key of sortedKeys) {
    signString += key + paramsForSigning[key];
  }
  signString += APP_SECRET;
  
  const sign = createHash('md5').update(signString).digest('hex').toUpperCase();
  params.sign = sign;
  params.sign_method = 'md5';
  
  // Build URL
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  const url = `https://openapi.aliexpress.com/gateway.do?${queryString}`;
  
  console.log('Timestamp:', timestamp);
  console.log('Sign:', sign.substring(0, 16) + '...');
  console.log('URL:', url.substring(0, 150) + '...');
  
  try {
    const response = await fetch(url, { method: 'GET' });
    const contentType = response.headers.get('content-type') || '';
    console.log('Response:', response.status, contentType);
    
    if (contentType.includes('json')) {
      const data = await response.json();
      console.log('✅ JSON Response:', JSON.stringify(data).substring(0, 200));
    } else {
      const text = await response.text();
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        console.log('❌ HTML Response (404)');
      } else {
        console.log('Response text:', text.substring(0, 200));
      }
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

(async () => {
  for (const method of methods) {
    await testMethod(method);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
  }
})();
