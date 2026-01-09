import { SmartHarvester } from '@/lib/automation/harvester';
import { AIRefiner, startRefinerJob } from '@/lib/automation/refiner';
import { adminDb } from '@/lib/firebase-admin';

async function run() {
  const jobId = `harvest_test_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const harvester = new SmartHarvester(jobId);

  console.log('🟡 Building category queries for root: elektronika');
  const categories = await SmartHarvester.buildCategoryQueries('elektronika');
  const subset = categories.slice(0, 6); // limit to a few paths
  console.log('📚 Categories subset:', subset);

  console.log('🚜 Running harvester (AliExpress, tree mode, maxResults=30)...');
  const job = await harvester.harvestProducts('aliexpress', 'category-tree', 30, subset, true);
  console.log('✅ Harvester completed:', {
    productsFound: job.productsFound,
    productsCreated: job.productsCreated,
    dealsCreated: job.dealsCreated,
    duplicatesSkipped: job.duplicatesSkipped,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });

  // Fetch recently created products (filter client-side by createdAt >= job.startedAt)
  const snap = await adminDb.collection('product_cores').get();
  const recent = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(p => typeof p.createdAt === 'string' && p.createdAt >= (job.startedAt || ''));

  const withSubSub = recent.filter(p => !!p.subSubCategorySlug);
  console.log(`📊 Products created since job start: ${recent.length}`);
  console.log(`   ➤ With sub-subcategory: ${withSubSub.length}`);
  console.log(`   ➤ Without sub-subcategory: ${recent.length - withSubSub.length}`);

  // Refine only those missing subSubCategorySlug
  const missingIds = recent.filter(p => !p.subSubCategorySlug).map(p => p.id);
  if (missingIds.length > 0) {
    console.log(`🛠️ Refining ${missingIds.length} products to fill sub-subcategory...`);
    const refineJob = await startRefinerJob(missingIds, 'full_enrichment');
    console.log('✅ Refiner completed:', {
      productsProcessed: refineJob.productsProcessed,
      productsSuccessful: refineJob.productsSuccessful,
      productsFailed: refineJob.productsFailed,
    });

    // Recount after refinement
    const snap2 = await adminDb.collection('product_cores').get();
    const recent2 = snap2.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(p => typeof p.createdAt === 'string' && p.createdAt >= (job.startedAt || ''));
    const withSubSub2 = recent2.filter(p => !!p.subSubCategorySlug);
    console.log(`📈 After refinement: with sub-subcategory ${withSubSub2.length}/${recent2.length}`);
  } else {
    console.log('🟢 All recent products already have sub-subcategory set.');
  }
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exitCode = 1;
});
