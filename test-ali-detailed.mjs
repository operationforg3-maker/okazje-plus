import crypto from 'crypto';

const APP_KEY = '526032';
const APP_SECRET = 'r4h4or9ZlZYPCjsllrqLXufzwx0iToUV';

async function testAliExpressDetailed() {
  console.log('🔍 Detailed AliExpress API Test\n');
  
  // Build params
  const params = {
    method: 'aliexpress.affiliate.product.query',
    app_key: APP_KEY,
    sign_method: 'md5',
    timestamp: Date.now().toString(),
    format: 'json',
    v: '2.0',
    simplify: 'true',
    keywords: 'phone',
    page_no: '1',
    page_size: '1',
  };

  console.log('📋 Request params:');
  console.log(JSON.stringify(params, null, 2));
  console.log('');

  // Generate signature
  const sortedKeys = Object.keys(params).sort();
  let signString = APP_SECRET;
  for (const key of sortedKeys) {
    signString += key + params[key];
  }
  signString += APP_SECRET;
  
  console.log('🔐 Sign string (first 100 chars):');
  console.log(signString.substring(0, 100) + '...');
  console.log('');
  
  const sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
  params.sign = sign;

  console.log('✅ Signature:', sign);
  console.log('');

  // Build query string
  const queryString = Object.keys(params)
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');

  const url = `https://openapi.aliexpress.com/gateway.do?${queryString}`;

  console.log('🌐 Full URL (truncated):');
  console.log(url.substring(0, 150) + '...\n');

  try {
    console.log('⏳ Sending request...\n');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OkazjePlus/1.0)',
      },
    });
    
    console.log('📥 Response:');
    console.log('Status:', response.status, response.statusText);
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('');
    
    const responseText = await response.text();
    console.log('Body (first 500 chars):');
    console.log(responseText.substring(0, 500));
    console.log('');
    
    if (responseText.startsWith('<')) {
      console.log('❌ Received HTML instead of JSON!');
      console.log('');
      console.log('🔍 Possible causes:');
      console.log('   1. APP_KEY is incorrect or inactive');
      console.log('   2. APP_KEY doesn\'t have Affiliate API access');
      console.log('   3. IP address not whitelisted (if required)');
      console.log('   4. Account suspended or quota exceeded');
      console.log('   5. Need to register at: https://portals.aliexpress.com/');
      console.log('');
      console.log('📝 Next steps:');
      console.log('   1. Log in to: https://portals.aliexpress.com/');
      console.log('   2. Go to API Management → My Apps');
      console.log('   3. Verify APP_KEY 526032 exists and is active');
      console.log('   4. Check API permissions include "Product Query"');
      console.log('   5. If needed, create new APP_KEY');
    } else {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Valid JSON response!');
        console.log(JSON.stringify(data, null, 2));
      } catch (e) {
        console.log('⚠️  Response is not valid JSON');
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testAliExpressDetailed();
