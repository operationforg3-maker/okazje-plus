#!/usr/bin/env node
/**
 * Test AliExpress API with proper authentication
 * Uses signature-based authentication (APP_KEY + APP_SECRET)
 */

import crypto from 'crypto';
import { config } from 'dotenv';

config({ path: '.env.local' });

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;

if (!APP_KEY || !APP_SECRET) {
  console.error('❌ Missing ALIEXPRESS_APP_KEY or ALIEXPRESS_APP_SECRET in .env.local');
  process.exit(1);
}

console.log('📋 Test Zapytania do AliExpress API\n');
console.log(`✓ APP_KEY: ${APP_KEY}`);
console.log(`✓ APP_SECRET configured: ${APP_SECRET.substring(0, 10)}...`);

/**
 * Generate MD5 signature for AliExpress API requests
 * According to AliExpress TOP API documentation
 */
function generateSignature(params: Record<string, string>, appSecret: string): string {
  // Sort parameters
  const sortedKeys = Object.keys(params).sort();
  
  // Build signature string: app_key + param1value1param2value2 + app_secret
  let signatureString = appSecret; // Start with app_secret
  
  for (const key of sortedKeys) {
    signatureString += key + params[key];
  }
  
  signatureString += appSecret; // End with app_secret
  
  // MD5 hash and convert to uppercase
  const md5Hash = crypto.createHash('md5').update(signatureString).digest('hex').toUpperCase();
  return md5Hash;
}

/**
 * Make signed request to AliExpress TOP API
 */
async function makeSignedRequest(method: string, params: Record<string, string>) {
  console.log(`\n🔗 ${method} Request to AliExpress API\n`);
  console.log('Parameters:');
  Object.entries(params).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  // Add app_key to params
  const allParams = {
    app_key: APP_KEY,
    ...params,
  };

  // Generate signature
  const sign = generateSignature(allParams, APP_SECRET);
  console.log(`  sign: ${sign.substring(0, 10)}...`);

  // Build request URL
  const baseUrl = 'https://openapi.aliexpress.com/gateway.do';
  const queryString = new URLSearchParams({
    ...allParams,
    sign,
  }).toString();

  const url = `${baseUrl}?${queryString}`;

  console.log(`\n📤 Sending request...\n`);

  try {
    const response = await fetch(url);
    const text = await response.text();

    console.log(`Status: ${response.status}\n`);
    console.log('Response (first 500 chars):');
    console.log(text.substring(0, 500));

    if (text.includes('error')) {
      console.log('\n⚠️ Response contains error field');
    } else {
      console.log('\n✅ Response looks good!');
    }

    return text;
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

/**
 * Test 1: aliexpress.postCategory.queryPostCategory
 * Query available categories
 */
async function testQueryCategories() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Query Categories');
  console.log('='.repeat(60));

  await makeSignedRequest('aliexpress.postCategory.queryPostCategory', {
    method: 'aliexpress.postCategory.queryPostCategory',
    timestamp: Math.floor(Date.now() / 1000).toString(),
  });
}

/**
 * Test 2: aliexpress.postProduct.search
 * Search for products
 */
async function testSearchProducts() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Search Products');
  console.log('='.repeat(60));

  await makeSignedRequest('aliexpress.postProduct.search', {
    method: 'aliexpress.postProduct.search',
    keywords: 'smartphone',
    pageNumber: '1',
    pageSize: '10',
    timestamp: Math.floor(Date.now() / 1000).toString(),
  });
}

/**
 * Test 3: aliexpress.postProduct.getHotProducts
 * Get hot/trending products
 */
async function testGetHotProducts() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Get Hot Products');
  console.log('='.repeat(60));

  await makeSignedRequest('aliexpress.postProduct.getHotProducts', {
    method: 'aliexpress.postProduct.getHotProducts',
    pageNumber: '1',
    pageSize: '20',
    timestamp: Math.floor(Date.now() / 1000).toString(),
  });
}

/**
 * Simple test - just check connectivity
 */
async function testSimpleConn() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 0: Simple Connectivity Check');
  console.log('='.repeat(60));

  try {
    console.log('\nTesting basic HTTPS connection to AliExpress...\n');
    const response = await fetch('https://openapi.aliexpress.com/gateway.do', {
      method: 'GET',
    });

    console.log(`✅ Connection established`);
    console.log(`Status: ${response.status} ${response.statusText}`);

    const text = await response.text();
    console.log(`Response size: ${text.length} bytes`);
    console.log(`First 300 chars: ${text.substring(0, 300)}`);
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

async function runTests() {
  await testSimpleConn();
  await testQueryCategories();
  await testSearchProducts();
  await testGetHotProducts();

  console.log('\n' + '='.repeat(60));
  console.log('✅ All API tests completed');
  console.log('='.repeat(60) + '\n');
}

runTests().catch(console.error);
