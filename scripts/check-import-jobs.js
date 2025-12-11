const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkJobs() {
  try {
    const snap = await db.collection('import_jobs').orderBy('createdAt', 'desc').limit(10).get();
    
    if (snap.empty) {
      console.log('❌ No import jobs found in Firestore!');
      process.exit(1);
    }
    
    console.log(`\n=== Last 10 Import Jobs ===\n`);
    
    snap.forEach(doc => {
      const d = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`  Status: ${d.status}`);
      console.log(`  Type: ${d.importerType}`);
      console.log(`  Created: ${d.createdAt?.toDate?.() || 'N/A'}`);
      console.log(`  Batches: ${d.batches?.length || 0}`);
      console.log(`  Current Index: ${d.currentBatchIndex || 0}`);
      console.log(`  Progress: ${d.currentBatchIndex || 0}/${d.batches?.length || 0}`);
      console.log(`  Products Imported: ${d.productsImported || 0}`);
      console.log(`  Sources: ${d.sources?.join(', ') || 'N/A'}`);
      console.log('');
    });
    
    // Get one job for detailed inspection
    const firstJob = snap.docs[0];
    const jobData = firstJob.data();
    
    console.log(`\n=== Detailed Inspection of Job ${firstJob.id} ===\n`);
    console.log('Full job data:');
    console.log(JSON.stringify(jobData, null, 2));
    
    if (jobData.batches && jobData.batches.length > 0) {
      console.log(`\n=== First 3 Batches ===`);
      jobData.batches.slice(0, 3).forEach((batch, idx) => {
        console.log(`Batch ${idx}:`, JSON.stringify(batch, null, 2));
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking jobs:', error);
    process.exit(1);
  }
}

checkJobs();
