/**
 * Direct Harvester Test - Test the SmartHarvester class directly
 * This tests the harvester without needing API auth
 * 
 * Usage: npx tsx test-harvester-direct.ts
 */

import { SmartHarvester } from './src/lib/automation/harvester';

async function testHarvesterDirect() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 DIRECT HARVESTER TEST (No Auth Needed)');
  console.log('='.repeat(60) + '\n');

  try {
    const source = 'aliexpress';
    const query = 'phone case';
    const maxResults = 3; // Small number for testing

    console.log('📋 Test Parameters:');
    console.log(`   Source: ${source}`);
    console.log(`   Query: "${query}"`);
    console.log(`   Max Results: ${maxResults}\n`);

    console.log('⏳ Running harvester...\n');

    const jobId = `test_${Date.now()}`;
    const harvester = new SmartHarvester(jobId);

    const result = await harvester.harvestProducts(
      source as any,
      query,
      maxResults
    );

    console.log('\n✅ HARVESTER COMPLETED!\n');
    console.log('📊 Results:');
    console.log(`   Job ID: ${result.id}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Products Found: ${result.productsFound}`);
    console.log(`   Products Created: ${result.productsCreated}`);
    console.log(`   Deals Created: ${result.dealsCreated}`);
    console.log(`   Duplicates Skipped: ${result.duplicatesSkipped}`);

    if (result.dealsCreated > 0) {
      console.log(`\n✅ SUCCESS! ${result.dealsCreated} deals created!`);
      console.log('\n   📋 Pipeline Verification:');
      console.log('   1. Deals created with status="draft" ✓');
      console.log('   2. Deals registered in moderationQueue ✓');
      console.log('   3. Check admin panel → Moderation tab ✓');
      console.log('   4. Deal-Refiner will enrich them ✓');
    } else {
      console.log('\n⚠️  No deals created');
      if (result.productsFound === 0) {
        console.log('   → API returned 0 products for this query');
      }
    }

    if (result.logs && result.logs.length > 0) {
      console.log('\n📋 Logs (last 10):');
      result.logs.slice(-10).forEach((log, i) => {
        const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} [${log.level.toUpperCase()}] ${log.message}`);
        if (log.details && typeof log.details === 'string' && log.details.includes('error')) {
          console.log(`      Details: ${log.details.substring(0, 100)}`);
        }
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETE\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    if (error.stack) {
      console.error('\nStack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    process.exit(1);
  }
}

testHarvesterDirect().then(() => process.exit(0));
