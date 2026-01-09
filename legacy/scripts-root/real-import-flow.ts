/**
 * Real M6 Import Flow - Either with real AliExpress API or test data
 * Uses actual harvester + refiner pipeline
 */
import { SmartHarvester } from '@/lib/automation/harvester';
import { refinePendingProducts } from '@/lib/automation/refiner';
import { adminDb } from '@/lib/firebase-admin';

async function realImportFlow() {
  console.log('🚀 Real M6 Import Flow\n');

  // Step 1: Harvest
  console.log('📥 Step 1: Harvesting products...\n');
  const jobId = `harvest_real_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const harvester = new SmartHarvester(jobId);

  const queries = [
    'electronics/smartfony-telefony/smartphone',
    'electronics/komputery/laptop',
    'electronics/audio-video/headphones',
    'home-garden/meble/sofa',
    'fashion/odziez-damska/dress'
  ];

  console.log(`🔍 Querying ${queries.length} categories:\n`);
  const harvestJob = await harvester.harvestProducts(
    'aliexpress',
    'products',
    40,
    queries,
    true // tree mode
  );

  console.log(`\n✅ Harvest Result:`);
  console.log(`   Products Created: ${harvestJob.productsCreated}`);
  console.log(`   Deals Created: ${harvestJob.dealsCreated}`);
  console.log(`   Errors: ${harvestJob.errors.length}`);

  if (harvestJob.errors.length > 0) {
    console.log(`\n⚠️ Errors:`);
    harvestJob.errors.slice(0, 5).forEach(err => {
      console.log(`   - ${err.message}`);
    });
  }

  // Step 2: Check what was created
  console.log(`\n\n-> Step 2: Checking database state...\n`);
  const productsSnap = await adminDb.collection('product_cores').where('status', '==', 'pending_approval').limit(5).get();
  const dealsSnap = await adminDb.collection('deals').where('status', '==', 'approved').limit(5).get();

  console.log(`✅ Pending Products (awaiting refiner): ${productsSnap.size}`);
  console.log(`✅ Approved Deals: ${dealsSnap.size}`);

  // Step 3: Refine products
  if (productsSnap.size > 0) {
    console.log(`\n\n🤖 Step 3: Running Refiner on pending products...\n`);
    try {
      const refinerJob = await refinePendingProducts();
      console.log(`✅ Refined ${refinerJob.productsSuccessful} products, failures=${refinerJob.productsFailed}`);
    } catch (e: any) {
      console.log(`⚠️ Refiner skipped: ${e.message}`);
    }
  }

  // Step 4: Approve all products for visibility
  console.log(`\n\n✨ Step 4: Approving all products...\n`);
  const allProducts = await adminDb.collection('product_cores').limit(100).get();
  let approvedCount = 0;
  for (const doc of allProducts.docs) {
    if (doc.data().status !== 'approved') {
      await doc.ref.update({ status: 'approved' });
      approvedCount++;
    }
  }
  console.log(`✅ Approved ${approvedCount} products`);

  // Step 5: Final stats
  console.log(`\n\n📈 Step 5: Final Statistics\n`);
  const finalProducts = await adminDb.collection('product_cores').where('status', '==', 'approved').get();
  const finalDeals = await adminDb.collection('deals').where('status', '==', 'approved').get();

  console.log(`✅ Total Approved Products: ${finalProducts.size}`);
  console.log(`✅ Total Approved Deals: ${finalDeals.size}`);

  console.log(`\n🎉 Import Flow Complete!\n`);
}

realImportFlow()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Import failed:', err);
    process.exit(1);
  });
