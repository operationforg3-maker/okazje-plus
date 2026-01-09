/**
 * Test import with ONE category to verify fix works
 * Should see products passing through all stages now
 */
const fetch = require('node-fetch');
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testImport() {
  try {
    console.log('\n=== Starting Test Import ===\n');
    
    // Get admin token (you'll need to authenticate properly)
    // For now, we'll call the API directly with a small batch
    
    const response = await fetch('http://localhost:9002/api/admin/import/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'full',
        importerType: 'keyword-search',
        maxItemsPerSubcategory: 5, // Small test
        // You'll need to add auth header here
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Import start failed:', data);
      process.exit(1);
    }
    
    console.log('✅ Import started:', data);
    const jobId = data.jobId;
    
    // Wait 30 seconds for processing
    console.log('\nWaiting 30 seconds for processing...\n');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Check job status
    const jobDoc = await db.collection('import_jobs').doc(jobId).get();
    const jobData = jobDoc.data();
    
    console.log('=== Job Status ===');
    console.log(`Status: ${jobData.status}`);
    console.log(`Progress: ${jobData.currentBatchIndex || 0}/${jobData.batches?.length || 0}`);
    
    const logs = jobData.logs || [];
    const lastLog = logs[logs.length - 1];
    
    if (lastLog) {
      console.log('\n=== Last Batch ===');
      console.log(`Subcategory: ${lastLog.subcategory}`);
      console.log(`Stages:`);
      console.log(`  fetched: ${lastLog.stages.fetched}`);
      console.log(`  deduplicated: ${lastLog.stages.deduplicated}`);
      console.log(`  enriched: ${lastLog.stages.enriched}`);
      console.log(`  translated: ${lastLog.stages.translated}`);
      console.log(`  saved: ${lastLog.stages.saved}`);
      
      if (lastLog.stages.fetched > 0 && lastLog.stages.deduplicated > 0) {
        console.log('\n✅✅✅ SUCCESS! Products passing through dedupe stage!\n');
      } else if (lastLog.stages.fetched > 0 && lastLog.stages.deduplicated === 0) {
        console.log('\n❌ STILL BROKEN: Products fetched but not deduplicated\n');
      }
    }
    
    // Check products in database
    const productsSnap = await db.collection('products')
      .where('importJobId', '==', jobId)
      .limit(5)
      .get();
    
    console.log(`\nProducts in database: ${productsSnap.size}`);
    
    if (productsSnap.size > 0) {
      console.log('✅ Products saved to database!');
      console.log('Sample:', productsSnap.docs[0].data().title);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testImport();
