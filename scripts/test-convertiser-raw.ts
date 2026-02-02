/**
 * Test raw Convertiser API response
 * Debug script to see actual structure
 */

import { getConvertiserClient } from '@/lib/integrations/convertiser-client';

async function testConvertiserRaw() {
  console.log('🔍 Testing raw Convertiser API response\n');

  try {
    const client = getConvertiserClient();

    console.log('Test 1: searchProductsV2\n');
    const response1 = await client.searchProductsV2(
      {
        query: 'smartphone',
        country: 'PL',
      },
      {
        page: 1,
        page_size: 3,
      }
    );

    console.log(`Found ${response1.results?.length || 0} products (v2)\n`);
    if (response1.results && response1.results.length > 0) {
      response1.results.forEach((product: any, idx: number) => {
        console.log(`\n📦 Product ${idx + 1}:`);
        console.log(JSON.stringify(product, null, 2));
      });
    } else {
      console.log('Response:', JSON.stringify(response1, null, 2));
    }

    console.log('\n\nTest 2: searchProducts (v1)\n');
    const response2 = await client.searchProducts(
      {
        query: 'smartphone',
        country: 'PL',
      },
      {
        page: 1,
        page_size: 3,
      }
    );

    console.log(`Found ${response2.results?.length || 0} products (v1)\n`);
    if (response2.results && response2.results.length > 0) {
      response2.results.forEach((product: any, idx: number) => {
        console.log(`\n📦 Product ${idx + 1}:`);
        console.log(JSON.stringify(product, null, 2));
      });
    } else {
      console.log('Response:', JSON.stringify(response2, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testConvertiserRaw();
