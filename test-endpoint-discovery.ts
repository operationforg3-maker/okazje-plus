#!/usr/bin/env tsx
/**
 * AliExpress API Endpoint Discovery & Test
 * 
 * Tests both endpoints to find which one works
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createHash } from 'crypto';

config({ path: resolve(process.cwd(), '.env.local') });

const appKey = process.env.ALIEXPRESS_APP_KEY!;
const appSecret = process.env.ALIEXPRESS_APP_SECRET!;

function generateSignature(params: Record<string, any>, secret: string): string {
  const trimmedSecret = (secret || '').trim();
  const sortedKeys = Object.keys(params).sort();
  let signString = trimmedSecret;
  for (const key of sortedKeys) {
    signString += key + String(params[key]);
  }
  signString += trimmedSecret;
  return createHash('md5').update(signString).digest('hex').toUpperCase();
}

async function testEndpoint(endpoint: string, params: Record<string, any>) {
  console.log(`\n🧪 Testing: ${endpoint}`);
  console.log('─'.repeat(60));
  
  const signature = generateSignature(params, appSecret);
  params.sign = signature;
  
  const body = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&');
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: body,
      signal: AbortSignal.timeout(15000),
    });
    
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    const text = await response.text();
    console.log(`Response length: ${text.length} bytes`);
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(text);
      console.log('✅ Valid JSON response');
      const key = Object.keys(data)[0];
      if (key) {
        console.log(`Response key: ${key}`);
        const respCode = data[key]?.resp_code;
        console.log(`Response code: ${respCode}`);
      }
      return true;
    } catch {
      console.log(`❌ Not JSON, first 100 chars: ${text.substring(0, 100)}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    return false;
  }
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 AliExpress Endpoint Discovery');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const timestamp = new Date().toISOString()
    .replace('T', ' ')
    .substring(0, 19);
  
  const params = {
    method: 'aliexpress.affiliate.product.query',
    app_key: appKey,
    sign_method: 'md5',
    timestamp: timestamp,
    format: 'json',
    v: '2.0',
    simplify: 'true',
    keywords: 'phone',
    page_no: '1',
    page_size: '1',
  };
  
  console.log(`\nApp Key: ${appKey}`);
  console.log(`Timestamp: ${timestamp}`);
  console.log('\nEndpoint Comparison:');
  
  const endpoints = [
    'https://openapi.aliexpress.com/gateway.do',
    'https://api-sg.aliexpress.com/sync',
    'https://gw.api.taobao.com/router/rest',
  ];
  
  const results = [];
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint, { ...params });
    results.push({ endpoint, success });
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Results Summary:');
  console.log('─'.repeat(60));
  results.forEach(r => {
    console.log(`${r.success ? '✅' : '❌'} ${r.endpoint}`);
  });
})();
