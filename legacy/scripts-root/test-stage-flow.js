const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testStageFlow() {
  try {
    // Get running job (or any recent job)
    const jobsSnap = await db.collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    if (jobsSnap.empty) {
      console.log('❌ No jobs found');
      process.exit(1);
    }
    
    // Find running job or use most recent
    let jobDoc = jobsSnap.docs.find(doc => doc.data().status === 'running');
    if (!jobDoc) {
      console.log('⚠️ No running job, using most recent job');
      jobDoc = jobsSnap.docs[0];
    }
    
    const jobData = jobDoc.data();
    
    console.log(`\n=== Testing Stage Flow for Job ${jobDoc.id} ===\n`);
    console.log(`Status: ${jobData.status}`);
    console.log(`Progress: ${jobData.currentBatchIndex || 0}/${jobData.batches?.length || 0}`);
    console.log(`\nLast 3 Logs:\n`);
    
    const logs = jobData.logs || [];
    const lastLogs = logs.slice(-3);
    
    lastLogs.forEach((log, idx) => {
      console.log(`\n--- Log ${logs.length - 3 + idx + 1} ---`);
      console.log(`Subcategory: ${log.subcategory}`);
      console.log(`Status: ${log.status}`);
      console.log(`Stages:`);
      console.log(`  fetched: ${log.stages.fetched}`);
      console.log(`  deduplicated: ${log.stages.deduplicated}`);
      console.log(`  enriched: ${log.stages.enriched}`);
      console.log(`  translated: ${log.stages.translated}`);
      console.log(`  saved: ${log.stages.saved}`);
      console.log(`Items Added: ${log.itemsAdded}`);
      console.log(`Items Updated: ${log.itemsUpdated}`);
      console.log(`Items Skipped: ${log.itemsSkipped}`);
      console.log(`Time: ${log.timeMs}ms`);
      
      // DIAGNOZA
      if (log.stages.fetched > 0 && log.stages.deduplicated === 0) {
        console.log(`\n⚠️ PROBLEM DETECTED: Products fetched but not deduplicated!`);
        console.log(`  This means stageDedupe is filtering out ALL products`);
        console.log(`  Possible causes:`);
        console.log(`    1. minOrders filter too high`);
        console.log(`    2. minRating filter too high`);
        console.log(`    3. minPrice/maxPrice filters too restrictive`);
        console.log(`    4. Product data format mismatch (missing rating/orders fields)`);
      }
      
      if (log.stages.deduplicated > 0 && log.stages.enriched === 0) {
        console.log(`\n⚠️ PROBLEM DETECTED: Products deduplicated but not enriched!`);
        console.log(`  This means stageEnrich is failing or returning empty array`);
      }
      
      if (log.stages.enriched > 0 && log.stages.translated === 0) {
        console.log(`\n⚠️ PROBLEM DETECTED: Products enriched but not translated!`);
        console.log(`  This means stageTranslate is failing`);
      }
      
      if (log.stages.translated > 0 && log.stages.saved === 0) {
        console.log(`\n⚠️ PROBLEM DETECTED: Products translated but not saved!`);
        console.log(`  This means stageSave is failing to write to Firestore`);
      }
    });
    
    // Check if ANY products were saved to database during this job
    console.log(`\n\n=== Checking Database for New Products ===\n`);
    
    const productsSnap = await db.collection('products')
      .where('importJobId', '==', jobDoc.id)
      .limit(5)
      .get();
    
    console.log(`Products with importJobId=${jobDoc.id}: ${productsSnap.size}`);
    
    if (productsSnap.size > 0) {
      console.log(`\n✅ Good! Products ARE being saved to database.`);
      console.log(`Sample product IDs:`, productsSnap.docs.map(d => d.id));
    } else {
      console.log(`\n❌ BAD! NO products saved with this importJobId.`);
      console.log(`This means stageSave is not writing to database OR importJobId not being set.`);
    }
    
    // Check recent products (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentProductsSnap = await db.collection('products')
      .where('createdAt', '>=', tenMinutesAgo)
      .limit(10)
      .get();
    
    console.log(`\nRecent products (last 10 min): ${recentProductsSnap.size}`);
    if (recentProductsSnap.size > 0) {
      console.log(`Sample recent product IDs:`, recentProductsSnap.docs.slice(0, 5).map(d => d.id));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testStageFlow();
