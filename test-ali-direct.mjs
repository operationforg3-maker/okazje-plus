import crypto from 'crypto';

const APP_KEY = '526032';
const APP_SECRET = 'r4h4or9ZlZYPCjsllrqLXufzwx0iToUV';

async function testAliExpressAPI() {
  // Build params
  const params = {
    method: 'aliexpress.affiliate.product.query',
    app_key: APP_KEY,
    sign_method: 'md5',
    timestamp: Date.now().toString(),
    format: 'json',
    v: '2.0',
    keywords: 'phone',
    page_size: '1'
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
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const url = `https://openapi.aliexpress.com/gateway.do?${queryString}`;

  console.log('🔍 Testing AliExpress TOP API...\n');
  console.log('Endpoint: https://openapi.aliexpress.com/gateway.do');
  console.log('Method: aliexpress.affiliate.product.query');
  console.log('Signature:', sign.substring(0, 20) + '...\n');

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error_response) {
      console.log('❌ API Error:', data.error_response.msg);
      console.log('Code:', data.error_response.code);
      console.log('Type:', data.error_response.type);
    } else if (data.aliexpress_affiliate_product_query_response) {
      const result = data.aliexpress_affiliate_product_query_response.resp_result.result;
      console.log('✅ API Working!');
      console.log('Total products:', result.total_record_count);
      if (result.products && result.products.product && result.products.product.length > 0) {
        const product = result.products.product[0];
        console.log('\nFirst product:');
        console.log('- Title:', product.product_title);
        console.log('- Price:', product.target_sale_price, product.target_sale_price_currency);
        console.log('- Product ID:', product.product_id);
      }
    } else {
      console.log('⚠️  Unexpected response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testAliExpressAPI();
