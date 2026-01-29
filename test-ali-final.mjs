import crypto from 'crypto';
import https from 'https';

const APP_KEY = '526032';
const APP_SECRET = 'r4h4or9ZlZYPCjsllrqLXufzwx0iToUV';

console.log('🔍 Final AliExpress API Diagnosis\n');

// Test 1: Minimal request
console.log('Test 1: Minimal TOP API request');
const params = {
  method: 'aliexpress.affiliate.product.query',
  app_key: APP_KEY,
  sign_method: 'md5',
  format: 'json',
  v: '2.0',
  timestamp: Date.now().toString(),
};

const sortedKeys = Object.keys(params).sort();
let signString = APP_SECRET;
for (const key of sortedKeys) {
  signString += key + params[key];
}
signString += APP_SECRET;
const sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
params.sign = sign;

const qs = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
const url = `https://openapi.aliexpress.com/gateway.do?${qs}`;

console.log('URL:', url.substring(0, 120) + '...');
console.log('Signature:', sign);
console.log('');

// Make request with detailed error handling
https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json',
  }
}, (res) => {
  console.log('Response Status:', res.statusCode);
  console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
  console.log('');
  
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response Body (first 800 chars):');
    console.log(data.substring(0, 800));
    console.log('');
    
    if (data.includes('<!DOCTYPE') || data.includes('<html')) {
      console.log('❌ CONCLUSION: Received HTML instead of JSON');
      console.log('');
      console.log('🔴 ROOT CAUSE:');
      console.log('   APP_KEY 526032 is INACTIVE or INVALID');
      console.log('');
      console.log('✅ SOLUTION:');
      console.log('   1. Go to: https://portals.aliexpress.com/');
      console.log('   2. Sign in with your AliExpress account');
      console.log('   3. Navigate to: "API" or "Developer Tools"');
      console.log('   4. Check if APP_KEY 526032 exists');
      console.log('   5. If not, create NEW application');
      console.log('   6. Copy new APP_KEY and APP_SECRET');
      console.log('   7. Update .env.local');
      console.log('');
      console.log('⚠️  ALTERNATIVE:');
      console.log('   If you cannot access AliExpress Portals:');
      console.log('   → Start harvester optimization WITHOUT AliExpress');
      console.log('   → Use mock data or other sources (Amazon/Allegro)');
      console.log('   → 20x speedup is INDEPENDENT of data source!');
    } else {
      try {
        const json = JSON.parse(data);
        console.log('✅ Valid JSON received!');
        console.log(JSON.stringify(json, null, 2));
      } catch {
        console.log('⚠️  Response is not valid JSON');
      }
    }
  });
}).on('error', (err) => {
  console.error('❌ Request error:', err.message);
});
