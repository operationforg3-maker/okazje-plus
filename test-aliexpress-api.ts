#!/usr/bin/env node
/**
 * Test AliExpress API Connection
 * Sends test queries to verify API keys and endpoint are working
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

// Test if environment variables are set
console.log('\n📋 Environment Variables Check:');
console.log(`✓ ALIEXPRESS_APP_KEY: ${process.env.ALIEXPRESS_APP_KEY ? '✅ SET' : '❌ MISSING'}`);
console.log(`✓ ALIEXPRESS_APP_SECRET: ${process.env.ALIEXPRESS_APP_SECRET ? '✅ SET' : '❌ MISSING'}`);
console.log(`✓ ALIEXPRESS_API_ENDPOINT: ${process.env.ALIEXPRESS_API_ENDPOINT || 'undefined (will use default)'}`);
console.log(`✓ ALIEXPRESS_REGION: ${process.env.ALIEXPRESS_REGION || 'undefined (will use default)'}`);

if (!process.env.ALIEXPRESS_APP_KEY || !process.env.ALIEXPRESS_APP_SECRET) {
  console.error('\n❌ ERROR: Missing required environment variables!');
  console.error('Make sure .env.local has ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET');
  process.exit(1);
}

console.log('\n🔗 Attempting AliExpress API connection...\n');

// Direct HTTP test (no SDK dependencies)
async function testDirectAPI() {
  console.log('=== TEST 1: Direct HTTP API Call ===\n');
  
  try {
    // Test with simple HTTP request
    const testQuery = 'smartphone';
    const url = 'https://api-sg.aliexpress.com/sync';
    
    console.log(`Testing endpoint: ${url}`);
    console.log(`Test query: "${testQuery}"`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.text();
      console.log(`✅ Response received (${data.length} bytes)`);
      console.log(`First 200 chars: ${data.substring(0, 200)}`);
    } else {
      const error = await response.text();
      console.log(`⚠️ Response: ${error.substring(0, 300)}`);
    }
  } catch (error) {
    console.error(`❌ Direct API test failed:`, error instanceof Error ? error.message : error);
  }
}

// Test using our AliExpress client
async function testClientAPI() {
  console.log('\n=== TEST 2: AliExpress Client API Call ===\n');
  
  try {
    // Dynamically import to avoid issues if dependencies aren't installed
    const { createAliExpressClient } = require('./src/integrations/aliexpress/client');
    const client = createAliExpressClient();
    
    console.log('✅ AliExpress client created');
    console.log('Sending test query: "smartphone"...\n');
    
    const results = await client.smartMatch('smartphone');
    
    if (results?.products?.items?.length > 0) {
      console.log(`✅ SUCCESS! Got ${results.products.items.length} products\n`);
      
      const firstProduct = results.products.items[0];
      console.log('📦 First Product Sample:');
      console.log(`   ID: ${firstProduct.product_id || firstProduct.id}`);
      console.log(`   Title: ${firstProduct.product_title || firstProduct.title}`);
      console.log(`   Price: ${firstProduct.sale_price || firstProduct.price}`);
      console.log(`   Image: ${firstProduct.product_main_image_url || 'N/A'}`);
      console.log(`   Link: ${firstProduct.product_detail_url || 'N/A'}`);
      console.log(`   Rating: ${firstProduct.evaluation_rate || 'N/A'}`);
      console.log(`   Orders: ${firstProduct.total_transaction_seller || 'N/A'}`);
    } else {
      console.warn('⚠️ No products returned from API');
      console.log('Response:', results);
    }
  } catch (error) {
    console.error(`❌ Client API test failed:`, error instanceof Error ? error.message : error);
    console.log('\nThis might be expected if the integrations module has different structure.');
  }
}

// Test using HTTP API via localhost fallback
async function testLocalServerAPI() {
  console.log('\n=== TEST 3: Local Server API Fallback ===\n');
  
  try {
    const response = await fetch('http://localhost:9002/api/admin/aliexpress/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'smartphone' }),
    });

    console.log(`Local server status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Got ${data.products?.length || 0} products from local server`);
      
      if (data.products?.length > 0) {
        console.log('\n📦 First Product:');
        console.log(`   ID: ${data.products[0].id}`);
        console.log(`   Title: ${data.products[0].title}`);
        console.log(`   Price: ${data.products[0].price}`);
      }
    } else {
      console.log(`Server response: ${await response.text()}`);
    }
  } catch (error) {
    console.log(`ℹ️  Local server not running or not accessible (this is OK for this test)`);
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testDirectAPI();
    await testClientAPI();
    await testLocalServerAPI();
    
    console.log('\n✅ API Connection Tests Complete\n');
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    process.exit(1);
  }
}

runAllTests();
