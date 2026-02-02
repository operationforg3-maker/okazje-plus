#!/usr/bin/env tsx
/**
 * Check AliExpress Authentication Status
 * 
 * Diagnoses:
 * 1. APP_KEY validity
 * 2. Signature generation
 * 3. API response type (JSON vs HTML)
 * 4. Account permissions
 */

import crypto from 'crypto';
import https from 'https';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const APP_KEY = process.env.ALIEXPRESS_APP_KEY!;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET!;
const API_ENDPOINT = 'openapi.aliexpress.com';

// Generate HMAC-MD5 signature
function generateSignature(params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  let signString = APP_SECRET;
  
  for (const key of sortedKeys) {
    signString += key + params[key];
  }
  signString += APP_SECRET;
  
  return crypto.createHash('md5').update(signString).digest('hex').toUpperCase();
}

// Test API call
function testApiCall(method: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now().toString();
    
    const params: Record<string, string> = {
      method,
      app_key: APP_KEY,
      timestamp,
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
    };
    
    // Add method-specific params
    if (method === 'aliexpress.affiliate.product.query') {
      params.fields = 'commission_rate,sale_price';
      params.keywords = 'phone';
      params.target_currency = 'PLN';
      params.target_language = 'PL';
      params.page_size = '1';
    }
    
    // Generate signature
    const sign = generateSignature(params);
    params.sign = sign;
    
    // Build query string
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const options = {
      hostname: API_ENDPOINT,
      path: `/gateway.do?${queryString}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    };
    
    console.log(`\n📡 Testing: ${method}`);
    console.log(`   Endpoint: https://${API_ENDPOINT}/gateway.do (POST)`);
    console.log(`   Signature: ${sign.substring(0, 16)}...`);
    
    const req = https.request({
      hostname: API_ENDPOINT,
      path: '/gateway.do',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const contentType = res.headers['content-type'] || '';
        
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Content-Type: ${contentType}`);
        
        if (contentType.includes('json')) {
          try {
            const json = JSON.parse(data);
            console.log(`   ✅ Response: JSON`);
            console.log(`   Keys: ${Object.keys(json).join(', ')}`);
            resolve({ method, status: 'success', data: json });
          } catch (e) {
            console.log(`   ❌ Invalid JSON`);
            resolve({ method, status: 'invalid_json', data: data.substring(0, 200) });
          }
        } else if (contentType.includes('html')) {
          console.log(`   ❌ Response: HTML (not JSON!)`);
          const title = data.match(/<title>(.*?)<\/title>/)?.[1] || 'No title';
          console.log(`   HTML Title: "${title}"`);
          
          // Check for specific error indicators
          if (data.includes('404')) {
            console.log(`   🔴 Error Type: 404 Not Found`);
          }
          if (data.includes('UNLOGIN') || data.includes('unauthorized')) {
            console.log(`   🔴 Error Type: Unauthorized/Not Logged In`);
          }
          
          resolve({ 
            method, 
            status: 'html_error', 
            title,
            snippet: data.substring(0, 500)
          });
        } else {
          console.log(`   ⚠️  Unknown Content-Type`);
          resolve({ method, status: 'unknown', data: data.substring(0, 200) });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ Request Error: ${err.message}`);
      reject(err);
    });
    
    const body = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    req.write(body);
  });
}

async function main() {
  console.log('🔍 AliExpress Authentication Diagnostics');
  console.log('=========================================\n');
  
  console.log('📋 Configuration:');
  console.log(`   APP_KEY: ${APP_KEY}`);
  console.log(`   APP_SECRET: ${APP_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`   API Endpoint: ${API_ENDPOINT}`);
  
  // Test multiple API methods
  const methods = [
    'aliexpress.affiliate.product.query',
    'aliexpress.affiliate.productdetail.get',
    'aliexpress.affiliate.link.generate',
  ];
  
  console.log('\n🧪 Testing API Methods...\n');
  
  const results: any[] = [];
  
  for (const method of methods) {
    try {
      const result = await testApiCall(method);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`);
      results.push({ method, status: 'error', error: error.message });
    }
  }
  
  // Summary
  console.log('\n\n📊 SUMMARY');
  console.log('=========================================');
  
  const successful = results.filter(r => r.status === 'success').length;
  const htmlErrors = results.filter(r => r.status === 'html_error').length;
  const otherErrors = results.filter(r => r.status !== 'success' && r.status !== 'html_error').length;
  
  console.log(`✅ Successful JSON responses: ${successful}/${methods.length}`);
  console.log(`❌ HTML error responses: ${htmlErrors}/${methods.length}`);
  console.log(`⚠️  Other errors: ${otherErrors}/${methods.length}`);
  
  if (htmlErrors > 0) {
    console.log('\n🔴 DIAGNOSIS:');
    console.log('   Your APP_KEY returns HTML 404 pages instead of JSON.');
    console.log('   This means:');
    console.log('   1️⃣  APP_KEY is INACTIVE or INVALID');
    console.log('   2️⃣  Your AliExpress account may lack Affiliate API access');
    console.log('   3️⃣  You need to create a NEW application in the portal');
    console.log('\n📝 SOLUTION:');
    console.log('   1. Go to: https://portals.aliexpress.com/');
    console.log('   2. Navigate to: API Management → My Apps');
    console.log('   3. Create NEW application (not check existing)');
    console.log('   4. Select "Affiliate API" type');
    console.log('   5. Copy NEW APP_KEY and APP_SECRET');
    console.log('   6. Update .env.local with NEW credentials');
    console.log('   7. Run this script again to verify');
  } else if (successful > 0) {
    console.log('\n✅ SUCCESS:');
    console.log('   Your APP_KEY is ACTIVE and working!');
    console.log('   You can now run the harvester.');
  } else {
    console.log('\n⚠️  UNCLEAR STATUS:');
    console.log('   Unable to determine API status.');
    console.log('   Check network connectivity and try again.');
  }
  
  console.log('\n');
}

main().catch(console.error);
