/**
 * Test Convertiser Integration
 * Verify token is accessible and API responds
 */

import { getConvertiserClient } from './src/lib/integrations/convertiser-client';

async function testConvertiser() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 CONVERTISER API TEST');
  console.log('='.repeat(60) + '\n');

  try {
    // 1. Check token
    console.log('📝 Step 1: Checking CONVERTISER_API_TOKEN...');
    const token = process.env.CONVERTISER_API_TOKEN;
    
    if (!token) {
      console.log('❌ Token NOT found in environment!');
      console.log('   Set with: export CONVERTISER_API_TOKEN="..."');
      process.exit(1);
    }
    
    console.log('✅ Token found!');
    console.log(`   Token (first 20 chars): ${token.substring(0, 20)}...`);
    console.log(`   Token length: ${token.length} characters\n`);

    // 2. Initialize client
    console.log('📝 Step 2: Initializing Convertiser client...');
    const client = getConvertiserClient();
    console.log('✅ Client initialized!\n');

    // 3. Search products
    console.log('📝 Step 3: Searching for products (query: "phone")...');
    const searchResult = await client.searchProductsV2(
      { query: 'phone', country: 'PL' },
      { page: 1, page_size: 5 }
    );

    console.log('✅ API Response received!\n');
    console.log('📊 Results:');
    
    const data = (searchResult as any).data || searchResult as any;
    const products = Array.isArray(data) ? data : data?.results || data?.data || [];
    
    console.log(`   Products found: ${products.length}`);
    
    if (products.length > 0) {
      console.log('\n   📋 Sample products:\n');
      products.slice(0, 3).forEach((product: any, i: number) => {
        console.log(`   ${i + 1}. ${product.title || product.name || 'Unknown'}`);
        console.log(`      Price: ${product.sale_price || product.price} PLN`);
        console.log(`      Link: ${product.direct_link || product.link || 'N/A'}\n`);
      });
    }

    console.log('\n' + '='.repeat(60));
    if (products.length > 0) {
      console.log('✅ CONVERTISER WORKING!');
      console.log('\n   Next: Run harvester with Convertiser');
      console.log('   → npx tsx test-harvester-direct.ts\n');
    } else {
      console.log('⚠️  API works but returned 0 products');
      console.log('   Try different search query\n');
    }
    console.log('='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
    process.exit(1);
  }
}

testConvertiser().then(() => process.exit(0));
