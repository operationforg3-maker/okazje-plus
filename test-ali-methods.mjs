import crypto from 'crypto';

const APP_KEY = '526032';
const APP_SECRET = 'r4h4or9ZlZYPCjsllrqLXufzwx0iToUV';

// Test różnych metod API
const TEST_METHODS = [
  'aliexpress.affiliate.product.query',
  'aliexpress.affiliate.productdetail.get',
  'aliexpress.affiliate.link.generate',
  'aliexpress.ds.product.get',
  'taobao.top.auth.token.create',
];

async function testMethod(methodName) {
  const params = {
    method: methodName,
    app_key: APP_KEY,
    sign_method: 'md5',
    timestamp: Date.now().toString(),
    format: 'json',
    v: '2.0',
  };

  // Generate signature
  const sortedKeys = Object.keys(params).sort();
  let signString = APP_SECRET;
  for (const key of sortedKeys) {
    signString += key + params[key];
  }
  signString += APP_SECRET;
  const sign = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
  params.sign = sign;

  // Build query string
  const queryString = Object.keys(params)
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join('&');

  const url = `https://openapi.aliexpress.com/gateway.do?${queryString}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'OkazjePlus/1.0' },
    });
    
    const text = await response.text();
    
    // Check if JSON or HTML
    if (text.startsWith('<')) {
      return { method: methodName, status: 'HTML_404', isJson: false };
    }
    
    try {
      const data = JSON.parse(text);
      if (data.error_response) {
        return { 
          method: methodName, 
          status: 'ERROR', 
          isJson: true,
          error: data.error_response 
        };
      }
      return { method: methodName, status: 'SUCCESS', isJson: true, data };
    } catch {
      return { method: methodName, status: 'INVALID_JSON', isJson: false };
    }
  } catch (error) {
    return { method: methodName, status: 'FETCH_ERROR', error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Testing AliExpress API Methods\n');
  console.log('APP_KEY:', APP_KEY);
  console.log('APP_SECRET:', APP_SECRET.substring(0, 10) + '...\n');
  
  for (const method of TEST_METHODS) {
    process.stdout.write(`Testing ${method.padEnd(50)} ... `);
    const result = await testMethod(method);
    
    if (result.status === 'SUCCESS') {
      console.log('✅ SUCCESS');
    } else if (result.status === 'ERROR') {
      console.log(`⚠️  ${result.error.code}: ${result.error.msg}`);
    } else if (result.status === 'HTML_404') {
      console.log('❌ HTML 404');
    } else {
      console.log(`❌ ${result.status}`);
    }
  }
  
  console.log('\n📊 Results Summary:');
  console.log('If ALL methods return HTML 404:');
  console.log('  → APP_KEY is invalid or account has no API access');
  console.log('  → Register at: https://portals.aliexpress.com/');
  console.log('\nIf SOME methods return JSON errors:');
  console.log('  → APP_KEY is valid but lacks specific permissions');
  console.log('  → Check API permissions in AliExpress portal');
}

runTests();
