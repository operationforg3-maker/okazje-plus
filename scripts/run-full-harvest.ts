import { SmartHarvester } from '@/lib/automation/harvester';
import { refinePendingProducts } from '@/lib/automation/refiner';
import { adminDb } from '@/lib/firebase-admin';

async function runFullHarvest() {
  console.log('🚀 M6 Full Harvest: ALL sub-subcategories (20 each)\n');

  // Build category query paths from Firestore (main/sub/subsub)
  const allQueries = await SmartHarvester.buildCategoryQueries();
  // Only strict 3-level paths: main/sub/subsub (exclude keyword-expansion paths)
  const subSubQueries = allQueries.filter((q) => q.split('/').length === 3);

  console.log(`📂 Categories discovered: total=${allQueries.length}, sub-sub=${subSubQueries.length}`);
  console.log(`   Example: ${subSubQueries.slice(0, 10).join(' | ')}`);

  const jobId = `harvest_full_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const harvester = new SmartHarvester(jobId);

  let totalProductsCreated = 0;
  let totalDealsCreated = 0;
  let totalDuplicates = 0;

  // Harvest sequentially to respect API rate limits
  for (const q of subSubQueries) {
    console.log(`\n🔎 Harvesting: ${q} (max 20)`);
    try {
      const job = await harvester.harvestProducts('aliexpress', 'products', 20, [q], true);
      console.log(`   → Created: products=${job.productsCreated}, deals=${job.dealsCreated}, dupes=${job.duplicatesSkipped}`);
      totalProductsCreated += job.productsCreated;
      totalDealsCreated += job.dealsCreated;
      totalDuplicates += job.duplicatesSkipped;
    } catch (e: any) {
      console.error(`   ✖ Failed for ${q}: ${e?.message || e}`);
    }
  }

  console.log(`\n✅ Harvest summary: products=${totalProductsCreated}, deals=${totalDealsCreated}, duplicates=${totalDuplicates}`);

  // Refine pending products via AI (descriptions/specs/tags)
  try {
    console.log('\n🤖 Running refiner on pending products...');
    const refinerJob = await refinePendingProducts();
    console.log(`   → Refiner processed ${refinerJob.productsProcessed} products, errors=${refinerJob.errors.length}`);
  } catch (e: any) {
    console.log(`   ⚠️ Refiner skipped: ${e?.message || e}`);
  }

  // Approve all products for visibility
  console.log('\n✨ Approving all products...');
  const allProducts = await adminDb.collection('product_cores').get();
  let approvedCount = 0;
  for (const doc of allProducts.docs) {
    if (doc.data().status !== 'approved') {
      await doc.ref.update({ status: 'approved' });
      approvedCount++;
    }
  }
  console.log(`   → Approved ${approvedCount} products`);

  // Final stats
  const finalProducts = await adminDb.collection('product_cores').where('status', '==', 'approved').get();
  const finalDeals = await adminDb.collection('deals').where('status', '==', 'approved').get();
  console.log(`\n📈 Final: approved products=${finalProducts.size}, approved deals=${finalDeals.size}`);

  console.log('\n🎉 Full Harvest Complete!');
}

runFullHarvest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Full harvest failed:', err);
    process.exit(1);
  });
