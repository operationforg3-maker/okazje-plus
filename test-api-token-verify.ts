#!/usr/bin/env tsx
/**
 * AliExpress API Test Suite - Token & Signature Verification
 * 
 * This script:
 * 1. Verifies credentials are loaded from .env.local
 * 2. Tests signature generation (fixed algorithm)
 * 3. Makes live API calls to AliExpress
 * 4. Validates response format
 * 
 * Run: npx tsx test-api-token-verify.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createHash } from 'crypto';

// Load environment
config({ path: resolve(process.cwd(), '.env.local') });

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 AliExpress API Token & Signature Test Suite');
console.log('═══════════════════════════════════════════════════════════════\n');

// ============================================================================
// STEP 1: Verify Credentials
// ============================================================================
console.log('✅ STEP 1: Verify Credentials from .env.local');
console.log('─────────────────────────────────────────────────────────────────');

const appKey = process.env.ALIEXPRESS_APP_KEY;
const appSecret = process.env.ALIEXPRESS_APP_SECRET;

if (!appKey || !appSecret) {
  console.error('❌ Missing credentials in .env.local');
  console.error('   Required: ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET');
  process.exit(1);
}

console.log(`✅ APP_KEY:     ${appKey}`);
console.log(`✅ APP_SECRET:  ${appSecret.substring(0, 8)}...${appSecret.substring(appSecret.length - 4)}`);
console.log(`✅ Secret length: ${appSecret.length} characters`);
console.log(`✅ Has trimmed: "${(appSecret || '').trim()}" === "${appSecret}" ? ${(appSecret || '').trim() === appSecret ? 'YES (clean)' : 'NO (has whitespace!)'}`);
console.log('');

// ============================================================================
// STEP 2: Test Signature Generation
// ============================================================================
console.log('✅ STEP 2: Test Signature Generation (Fixed Algorithm)');
console.log('─────────────────────────────────────────────────────────────────');

function generateSignature(params: Record<string, any>, secret: string): string {
  // FIXED: Trim secret to remove trailing whitespace
  const trimmedSecret = (secret || '').trim();
  
  // FIXED: Sort parameters alphabetically
  const sortedKeys = Object.keys(params).sort();
  
  // FIXED: Build signature string without URL encoding
  let signString = trimmedSecret;
  for (const key of sortedKeys) {
    const value = String(params[key]);
    signString += key + value;
  }
  signString += trimmedSecret;
  
  // Generate MD5
  const hash = createHash('md5').update(signString).digest('hex');
  return hash.toUpperCase();
}

// Test with realistic parameters
const testParams = {
  method: 'aliexpress.affiliate.product.query',
  app_key: appKey,
  sign_method: 'md5',
  timestamp: '2026-02-03 14:30:00',  // With space!
  format: 'json',
  v: '2.0',
  simplify: 'true',
  keywords: 'laptop pro',  // With space!
};

const testSig = generateSignature(testParams, appSecret);
console.log('📊 Test Parameters:');
console.log(`   - Method: ${testParams.method}`);
console.log(`   - Timestamp: ${testParams.timestamp} (with space ✅)`);
console.log(`   - Keywords: "${testParams.keywords}" (with space ✅)`);
console.log('');
console.log('🔐 Generated Signature:');
console.log(`   ${testSig}`);
console.log(`   Length: ${testSig.length} chars (MD5 = 32 chars ✅)`);
console.log('');

// ============================================================================
// STEP 3: Test Live API Call
// ============================================================================
console.log('✅ STEP 3: Test Live API Call to AliExpress');
console.log('─────────────────────────────────────────────────────────────────');

async function testApiCall() {
  try {
    // Prepare request parameters
    const timestamp = new Date().toISOString()
      .replace('T', ' ')
      .substring(0, 19);
    
    const requestParams: Record<string, any> = {
      method: 'aliexpress.affiliate.product.query',
      app_key: appKey,
      sign_method: 'md5',
      timestamp: timestamp,
      format: 'json',
      v: '2.0',
      simplify: 'true',
      keywords: 'phone',
      page_no: '1',
      page_size: '5',
    };
    
    console.log('📤 Request Parameters:');
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Endpoint: https://openapi.aliexpress.com/gateway.do`);
    console.log('');
    
    // Generate signature
    const signature = generateSignature(requestParams, appSecret);
    requestParams.sign = signature;
    
    console.log('🔐 Signature Generated:');
    console.log(`   ${signature.substring(0, 16)}...`);
    console.log('');
    
    // Build request body
    const body = Object.keys(requestParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(requestParams[key]))}`)
      .join('&');
    
    console.log('📨 Making HTTP POST request...');
    console.log('   Method: POST');
    console.log(`   Headers: Content-Type: application/x-www-form-urlencoded;charset=utf-8`);
    console.log('');
    
    // Make request
    const response = await fetch('https://openapi.aliexpress.com/gateway.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: body,
      signal: AbortSignal.timeout(30000),
    });
    
    console.log('📥 Response Received:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log('');
    
    const responseText = await response.text();
    console.log('📄 Response Body Preview:');
    console.log(`   ${responseText.substring(0, 200)}...`);
    console.log('');
    
    // Parse response
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('❌ Failed to parse JSON response');
      return false;
    }
    
    // Check for errors
    const responseKey = Object.keys(data)[0];
    const responseData = data[responseKey];
    
    if (!responseData) {
      console.error('❌ Unexpected response format');
      console.error(data);
      return false;
    }
    
    const respCode = responseData?.resp_code;
    const respMsg = responseData?.resp_msg;
    
    console.log('🎯 Response Status:');
    console.log(`   Code: ${respCode}`);
    console.log(`   Message: ${respMsg}`);
    console.log('');
    
    if (respCode === 200 || respCode === '200') {
      const resultData = responseData.result;
      const products = resultData?.products || [];
      const totalCount = resultData?.total_record_count;
      
      console.log('✅ SUCCESS! API Call Worked:');
      console.log(`   Total products: ${totalCount}`);
      console.log(`   Returned: ${products.length} items`);
      
      if (products.length > 0) {
        const firstProduct = products[0];
        console.log('');
        console.log('📦 First Product:');
        console.log(`   ID: ${firstProduct.product_id}`);
        console.log(`   Title: ${firstProduct.product_title?.substring(0, 60)}...`);
        console.log(`   Price: ${firstProduct.sale_price}`);
        console.log(`   Rating: ${firstProduct.evaluate_rate}`);
      }
      
      return true;
    } else if (respCode === 123 || respCode === '123') {
      console.error('❌ SIGNATURE MISMATCH!');
      console.error(`   AliExpress returned error code 123 (IncompleteSignature)`);
      console.error('   This means the signature calculation is still wrong');
      return false;
    } else {
      console.error(`❌ API Error: ${respMsg}`);
      console.error('Full response:', JSON.stringify(data, null, 2));
      return false;
    }
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

// ============================================================================
// STEP 4: Summary
// ============================================================================

(async () => {
  const success = await testApiCall();
  
  console.log('═══════════════════════════════════════════════════════════════');
  if (success) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('');
    console.log('✨ What this means:');
    console.log('   1. Credentials are properly configured');
    console.log('   2. Signature generation algorithm is correct');
    console.log('   3. API authentication works');
    console.log('   4. M6 Harvester can use AliExpress API');
    console.log('');
    console.log('🚀 Ready for production harvesting!');
  } else {
    console.log('❌ TESTS FAILED');
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   1. Check credentials in .env.local');
    console.log('   2. Ensure app_secret has no trailing whitespace');
    console.log('   3. Check network connectivity');
    console.log('   4. Review AliExpress docs: docs/M6_ALIEXPRESS_SIGNATURE_FIX.md');
  }
  console.log('═══════════════════════════════════════════════════════════════');
  
  process.exit(success ? 0 : 1);
})();
