/**
 * Test Convertiser Integration with M6 Harvester
 * 
 * This script tests the Convertiser API integration in the harvester flow:
 * 1. Fetch offers from Convertiser
 * 2. Map to RawProduct format
 * 3. Create ProductCore + Deal documents
 * 4. Verify in Firestore
 */

import { SmartHarvester } from '@/lib/automation/harvester';
import { adminDb } from '@/lib/firebase-admin';
import { v4 as uuid } from 'uuid';

async function testConvertiserIntegration() {
  console.log('🚀 Starting Convertiser Integration Test\n');

  const jobId = uuid();
  console.log(`Job ID: ${jobId}\n`);

  try {
    const harvester = new SmartHarvester(jobId);

    // Test 1: Search for products via Convertiser
    console.log('📱 Test 1: Searching for "smartphones" on Convertiser...');
    const searchQuery = 'smartphones';
    
    const result = await harvester.harvestProducts(
      'convertiser',
      searchQuery,
      10, // Limit to 10 for testing
    );

    console.log(`✅ Harvest result:`, result);
    console.log(`\nResults Summary:`);
    console.log(`  - Products Created: ${result.productsCreated}`);
    console.log(`  - Deals Created: ${result.dealsCreated}`);
    console.log(`  - Duplicates Skipped: ${result.duplicatesSkipped}`);
    console.log(`  - Total Logs: ${result.logs.length}\n`);

    // Display logs
    console.log('📋 Harvest Logs:');
    result.logs.forEach((log, idx) => {
      const prefix = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : 'ℹ️';
      console.log(`${prefix} ${log.message}`);
      if (log.details) {
        console.log(`   Details: ${JSON.stringify(log.details).substring(0, 100)}`);
      }
    });

    // Test 2: Verify products in Firestore
    if (result.productsCreated > 0) {
      console.log('\n🔍 Test 2: Verifying created products in Firestore...');
      
      const productsSnapshot = await adminDb
        .collection('product_cores')
        .where('status', '==', 'pending')
        .where('metadata.source', '==', 'convertiser')
        .limit(5)
        .get();

      console.log(`Found ${productsSnapshot.size} pending Convertiser products\n`);

      productsSnapshot.forEach((doc, idx) => {
        const product = doc.data();
        console.log(`Product ${idx + 1}:`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Title: ${product.title}`);
        console.log(`  Category: ${product.mainCategorySlug}/${product.subCategorySlug}`);
        console.log(`  Source: ${product.metadata?.source}`);
        console.log(`  Status: ${product.status}\n`);
      });
    }

    // Test 3: Verify deals in Firestore
    if (result.dealsCreated > 0) {
      console.log('🔍 Test 3: Verifying created deals in Firestore...');
      
      const dealsSnapshot = await adminDb
        .collection('deals')
        .where('source', '==', 'convertiser')
        .where('status', '==', 'pending')
        .limit(5)
        .get();

      console.log(`Found ${dealsSnapshot.size} pending Convertiser deals\n`);

      dealsSnapshot.forEach((doc, idx) => {
        const deal = doc.data();
        console.log(`Deal ${idx + 1}:`);
        console.log(`  ID: ${doc.id}`);
        console.log(`  Product ID: ${deal.productCoreId}`);
        console.log(`  Price: ${deal.price} ${deal.currency}`);
        console.log(`  Merchant: ${deal.merchantName}`);
        console.log(`  Source: ${deal.source}`);
        console.log(`  Status: ${deal.status}\n`);
      });
    }

    console.log('✅ Convertiser Integration Test Complete!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testConvertiserIntegration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
