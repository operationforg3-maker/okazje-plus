#!/usr/bin/env tsx
/**
 * Singapore Endpoint Debug - Full Response Analysis
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
  
  console.log('\n🔐 Signature Generation Details:');
  console.log(`   Secret: "${trimmedSecret.substring(0, 8)}...${trimmedSecret.substring(trimmedSecret.length - 4)}"`);
  console.log(`   Sorted keys: ${sortedKeys.join(', ')}`);
  console.log(`   String preview: ${signString.substring(0, 80)}...`);
  
  return createHash('md5').update(signString).digest('hex').toUpperCase();
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 Singapore Endpoint (api-sg.aliexpress.com) - Full Debug');
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
  
  console.log('\n📋 Parameters:');
  Object.entries(params).forEach(([k, v]) => {
    console.log(`   ${k}: ${v}`);
  });
  
  const signature = generateSignature(params, appSecret);
  console.log(`   Signature: ${signature}`);
  
  params.sign = signature;
  
  const body = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&');
  
  console.log('\n📨 Request Details:');
  console.log(`   Endpoint: https://api-sg.aliexpress.com/sync`);
  console.log(`   Method: POST`);
  console.log(`   Content-Type: application/x-www-form-urlencoded;charset=utf-8`);
  console.log(`   Body length: ${body.length} bytes`);
  
  const response = await fetch('https://api-sg.aliexpress.com/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: body,
    signal: AbortSignal.timeout(15000),
  });
  
  console.log('\n📥 Response:');
  console.log(`   Status: ${response.status}`);
  console.log(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}`);
  
  const text = await response.text();
  console.log(`\n📄 Response Body:`);
  console.log(text);
  
  try {
    const data = JSON.parse(text);
    console.log('\n✅ Parsed JSON:');
    console.log(JSON.stringify(data, null, 2));
  } catch {
    console.log('\n❌ Could not parse as JSON');
  }
})();
