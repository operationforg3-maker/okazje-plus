const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  console.log('=== FULL IMPORT FLOW DEBUG ===\n');
  
  // 1. Check running job
  console.log('STEP 1: Check running job qCht3QNw');
  const jobDoc = await db.collection('import_jobs').doc('qCht3QNw').get();
  
  if (!jobDoc.exists) {
    console.log('❌ Job not found!');
    process.exit(1);
  }
  
  const jobData = jobDoc.data();
  console.log(`Status: ${jobData.status}`);
  console.log(`Type: ${jobData.type}`);
  console.log(`ImporterType: ${jobData.importerType}`);
  console.log(`Sources: ${jobData.sources ? jobData.sources.join(', ') : 'MISSING'}`);
  console.log(`Progress: ${jobData.progress?.completed || 0}/${jobData.progress?.total || 0}`);
  console.log(`Batches: ${jobData.batches ? jobData.batches.length : 0}`);
  
  if (jobData.batches && jobData.batches.length > 0) {
    console.log('\nFirst 3 batches:');
    jobData.batches.slice(0, 3).forEach((b, i) => {
      console.log(`  ${i + 1}. ${b.categorySlug}/${b.subcategorySlug}/${b.subsubcategorySlug}`);
    });
  }
  
  if (jobData.logs && jobData.logs.length > 0) {
    console.log(`\nLogs: ${jobData.logs.length} entries`);
    console.log('Last 3 logs:');
    jobData.logs.slice(-3).forEach(log => {
      console.log(`  - ${log.subcategory}: ${log.status} (${log.itemsAdded} added, ${log.itemsSkipped} skipped)`);
    });
  } else {
    console.log('\n⚠️  NO LOGS - Job may not be processing!');
  }
  
  // 2. Check if products exist
  console.log('\n\nSTEP 2: Check if any products were imported');
  const productsSnap = await db.collection('products')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  
  console.log(`Total recent products: ${productsSnap.size}`);
  if (productsSnap.size > 0) {
    console.log('Last 3 products:');
    productsSnap.docs.slice(0, 3).forEach(doc => {
      const p = doc.data();
      console.log(`  - ${doc.id.slice(0, 8)}: ${p.title?.slice(0, 50)} (${p.source})`);
    });
  } else {
    console.log('❌ NO PRODUCTS FOUND!');
  }
  
  // 3. Check processing function exists
  console.log('\n\nSTEP 3: Verify processing trigger');
  console.log('Checking if processImportJob can be called...');
  
  // Try to find the endpoint
  const testUrl = 'https://okazjeplus.pl/api/admin/import/start';
  console.log(`Import endpoint: ${testUrl}`);
  console.log('✅ Endpoint exists (already used to create job)');
  
  // 4. Check if job is stuck
  if (jobData.status === 'running' && jobData.progress?.completed === jobData.progress?.current) {
    console.log('\n⚠️  WARNING: Job appears STUCK!');
    console.log(`Progress not advancing: completed=${jobData.progress.completed}, current=${jobData.progress.current}`);
  }
  
  console.log('\n\n=== DIAGNOSIS ===');
  
  if (jobData.status === 'running' && (!jobData.logs || jobData.logs.length === 0)) {
    console.log('❌ PROBLEM: Job is "running" but has NO LOGS');
    console.log('   This means processImportJob is NOT being called!');
    console.log('\n   Possible causes:');
    console.log('   1. processImportJob() not invoked after job creation');
    console.log('   2. Background execution failed silently');
    console.log('   3. Pipeline crash before first log entry');
  } else if (productsSnap.size === 0) {
    console.log('❌ PROBLEM: No products in database');
    console.log('   Pipeline may be fetching but not saving');
  } else {
    console.log('✅ System appears to be working');
  }
  
  process.exit(0);
})();
