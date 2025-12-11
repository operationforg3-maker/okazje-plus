const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function restartJob() {
  try {
    // Get running job
    const jobsSnap = await db.collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    if (jobsSnap.empty) {
      console.log('❌ No jobs found');
      process.exit(1);
    }
    
    // Find running job
    let jobDoc = jobsSnap.docs.find(doc => doc.data().status === 'running');
    if (!jobDoc) {
      console.log('❌ No running job found');
      process.exit(1);
    }
    
    console.log(`\n=== Stopping Job ${jobDoc.id} ===\n`);
    
    // Stop the job
    await jobDoc.ref.update({
      status: 'paused',
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ Job paused');
    console.log('\nNow you can:');
    console.log('  1. Start a new import with fixed filters');
    console.log('  2. Or resume this job (but it will still use old code until redeployed)');
    console.log('\nTo test the fix locally, deploy changes first or run import test.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

restartJob();
