const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  console.log('=== DEBUG: Checking all import_jobs ===\n');
  
  // Get ALL jobs regardless of status
  const allJobsSnap = await db.collection('import_jobs').get();
  console.log(`Total jobs in import_jobs: ${allJobsSnap.size}\n`);
  
  // Group by status
  const byStatus = {};
  allJobsSnap.docs.forEach(doc => {
    const status = doc.data().status;
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push({
      id: doc.id.slice(0, 8),
      status: doc.data().status,
      createdAt: doc.data().createdAt,
      error: doc.data().error,
    });
  });
  
  console.log('Jobs by status:');
  Object.entries(byStatus).forEach(([status, jobs]) => {
    console.log(`\n${status}: ${jobs.length}`);
    jobs.slice(0, 3).forEach(j => {
      console.log(`  - ${j.id}... (${j.createdAt ? new Date(j.createdAt).toLocaleTimeString() : 'no date'})`);
      if (j.error) console.log(`    Error: ${j.error}`);
    });
  });
  
  // Check for active (non-terminal) status
  const activeCount = (byStatus.queued?.length || 0) + 
                      (byStatus.running?.length || 0) + 
                      (byStatus.paused?.length || 0);
  console.log(`\n=== ACTIVE JOBS (queued|running|paused): ${activeCount} ===`);
  
  process.exit(0);
})();
