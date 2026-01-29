#!/usr/bin/env node
/**
 * Live Test: AliExpress Affiliate API
 * Tests hot products query with fresh timestamp
 */

const crypto = require('crypto');
const https = require('https');

const APP_KEY = '526032';
const APP_SECRET = 'r4h4or9ZlZYPCjsllrqLXufzwx0iToUV';

function generateSignature(params, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  let stringToSign = '';
  sortedKeys.forEach(k => stringToSign += k + params[k]);
  return crypto.createHmac('md5', appSecret).update(stringToSign).digest('hex').toUpperCase();
}

function makeRequest() {
  const now = new Date();
  const timestamp = now.toISOString().split('.')[0];
  
  const params = {
    app_key: APP_KEY,
    method: 'aliexpress.affiliate.hotproduct.query',
    timestamp: timestamp,
    sign_method: 'hmac_md5',
    v: '1.0',
    format: 'json'
  };

  const sign = generateSignature(params, APP_SECRET);
  const allParams = { ...params, sign };

  const queryString = new URLSearchParams(allParams).toString();
  const url = `https://api-sg.aliexpress.com/router/rest?${queryString}`;

  console.log(`\n🔗 AliExpress Affiliate API Test`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Method: aliexpress.affiliate.hotproduct.query`);
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Endpoint: https://api-sg.aliexpress.com/router/rest\n`);
  console.log(`📤 Sending request...\n`);

  https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        
        console.log(`✅ Status: ${res.statusCode}`);
        console.log(`\n📦 Response:\n`);
        console.log(JSON.stringify(json, null, 2));

        if (json.data) {
          const products = json.data.products || [];
          console.log(`\n✅ SUCCESS! Got ${products.length} hot products`);
          
          if (products.length > 0) {
            const first = products[0];
            console.log(`\nFirst Product:`);
            console.log(`  ID: ${first.product_id}`);
            console.log(`  Title: ${first.product_title}`);
            console.log(`  Price: ${first.sale_price} ${first.sale_price_currency}`);
            console.log(`  Rating: ${first.evaluation_rate}`);
            console.log(`  Orders: ${first.sale_count}`);
          }
        }
      } catch (e) {
        console.error(`❌ Failed to parse response:`, e.message);
        console.log(`Raw response:`, data.substring(0, 500));
      }
    });
  }).on('error', (e) => {
    console.error(`❌ Request failed:`, e.message);
  });
}

makeRequest();
