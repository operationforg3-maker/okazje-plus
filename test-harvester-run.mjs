#!/usr/bin/env node

/**
 * Test Harvester Pipeline - Call the harvester API endpoint
 * Usage: node test-harvester-run.mjs [source] [query] [maxResults]
 * 
 * Example:
 *   node test-harvester-run.mjs convertiser "smartphones" 10
 *   node test-harvester-run.mjs aliexpress "headphones" 5
 */

const source = process.argv[2] || 'convertiser';
const query = process.argv[3] || 'test';
const maxResults = Math.min(parseInt(process.argv[4]) || 5, 100);

// Dla lokalnego dev - bypass auth, ale na produkcji potrzebny admin token
const isLocalDev = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'okazje-plus';

console.log('\n' + '='.repeat(60));
console.log('🚀 HARVESTER TEST RUN');
console.log('='.repeat(60));
console.log(`\n📋 Parameters:`);
console.log(`   Source: ${source}`);
console.log(`   Query: "${query}"`);
console.log(`   Max Results: ${maxResults}\n`);

if (!process.env.ADMIN_TOKEN && !isLocalDev) {
  console.error('❌ Error: ADMIN_TOKEN environment variable is required for production');
  console.error('   Set it with: export ADMIN_TOKEN="your_admin_token"');
  process.exit(1);
}

const apiUrl = process.env.API_URL || 'http://localhost:9002';

async function runHarvester() {
  try {
    console.log(`📡 Calling: POST ${apiUrl}/api/admin/harvester/start\n`);

    const response = await fetch(`${apiUrl}/api/admin/harvester/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ADMIN_TOKEN ? { 'Authorization': `Bearer ${process.env.ADMIN_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        source,
        query,
        maxResults,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Error (${response.status}):`, data.error || 'Unknown error');
      process.exit(1);
    }

    if (data.success) {
      const result = data.result;
      console.log('✅ Harvester completed!\n');
      console.log('📊 Results:');
      console.log(`   Products Found: ${result.productsFound}`);
      console.log(`   Products Created: ${result.productsCreated}`);
      console.log(`   Deals Created: ${result.dealsCreated}`);
      console.log(`   Duplicates Skipped: ${result.duplicatesSkipped}`);
      console.log(`   Status: ${result.status}`);
      
      if (result.dealsCreated > 0) {
        console.log(`\n✅ ${result.dealsCreated} deals created!`);
        console.log('   → They should now be in moderationQueue');
        console.log('   → Admin can see them in the moderation panel');
        console.log('   → Deal-Refiner will enrich them');
      } else {
        console.log('\n⚠️  No deals created');
        console.log(`   → Try a different query or source`);
      }

      if (result.logs && result.logs.length > 0) {
        console.log('\n📋 Last 5 logs:');
        result.logs.slice(-5).forEach(log => {
          const icon = log.level === 'error' ? '❌' : log.level === 'warn' ? '⚠️' : 'ℹ️';
          console.log(`   ${icon} [${log.level.toUpperCase()}] ${log.message}`);
        });
      }
    } else {
      console.error('❌ API Error:', data.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Network Error:', error.message);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60) + '\n');
  process.exit(0);
}

runHarvester();
