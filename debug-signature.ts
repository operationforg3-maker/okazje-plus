#!/usr/bin/env tsx
/**
 * Debug AliExpress Signature Generation
 * 
 * Shows exactly how signature is generated and what params are sent
 */

import crypto from 'crypto';

const APP_KEY = '526032';
const APP_SECRET = 'r4h4or9ZlZYPCjsllrqLXufzwx0iToUV'; // STARY SECRET

// Generate signature exactly as in code
function generateSignature(params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  
  let signString = APP_SECRET;
  for (const key of sortedKeys) {
    signString += key + params[key];
  }
  signString += APP_SECRET;
  
  const hash = crypto.createHash('md5').update(signString).digest('hex');
  return hash.toUpperCase();
}

// Test params from AliExpress log
const testParams = {
  method: 'aliexpress.affiliate.product.query',
  keywords: 'phone',
  target_currency: 'PLN',
  target_language: 'PL',
  format: 'json',
  page_no: '1',
  sort: 'LAST_VOLUME_DESC',
  ship_to_country: 'PL',
  app_key: APP_KEY,
  v: '2.0',
  sign_method: 'md5',
  simplify: 'true',
  tracking_id: 'okazjaplus_1',
  timestamp: '2026-02-01 05:10:21', // From AliExpress log (old format)
  page_size: '1'
};

console.log('🔍 AliExpress Signature Debug');
console.log('==============================\n');

console.log('📋 Parameters (sorted):');
const sorted = Object.keys(testParams).sort();
sorted.forEach(key => {
  console.log(`   ${key} = ${testParams[key]}`);
});

console.log('\n🔐 Signature Generation:');
console.log(`APP_SECRET: ${APP_SECRET}`);

// Show signString construction
let signString = APP_SECRET;
console.log(`\n1. Start: "${signString}"`);

const sortedKeys = Object.keys(testParams).sort();
for (const key of sortedKeys) {
  signString += key + testParams[key];
  console.log(`2. Add ${key}=${testParams[key]}`);
}

signString += APP_SECRET;
console.log(`3. End: add APP_SECRET`);

console.log(`\nFinal signString length: ${signString.length}`);
console.log(`First 100 chars: ${signString.substring(0, 100)}`);

const signature = crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
console.log(`\n✅ Generated signature: ${signature}`);
console.log(`📋 Expected (from log): 5FFBE99464147EE5D5FBC7BFCC45527E`);
console.log(`\nMatch: ${signature === '5FFBE99464147EE5D5FBC7BFCC45527E' ? '✅ YES' : '❌ NO'}`);

// Try with current timestamp
console.log('\n\n--- Testing with CURRENT timestamp ---');
const now = new Date();
const currentTimestamp = now.toISOString().replace('T', ' ').substring(0, 19);

const currentParams = {
  ...testParams,
  timestamp: currentTimestamp
};

const currentSig = generateSignature(currentParams);
console.log(`Current timestamp: ${currentTimestamp}`);
console.log(`Current signature: ${currentSig}`);
