const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  console.log('=== EMERGENCY KILL ALL - Direct Firestore ===\n');
  console.log('Starting at:', new Date().toLocaleString('pl-PL'), '\n');
  
  let totalKilled = 0;
  
  // Kill NEW system active jobs
  console.log('Step 1: Killing NEW system (import_jobs)...');
  const activeNewStatuses = ['queued', 'running', 'paused', 'cancelled'];
  
  for (const status of activeNewStatuses) {
    const snap = await db.collection('import_jobs').where('status', '==', status).get();
    console.log(`  ${status}: found ${snap.size} jobs`);
    
    for (const doc of snap.docs) {
      await db.collection('import_jobs').doc(doc.id).update({
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: 'Emergency kill all - manual script',
        killedBy: 'admin-script',
        killedAt: new Date().toISOString(),
      });
      totalKilled++;
    }
  }
  
  // Kill OLD system active jobs
  console.log('\nStep 2: Killing OLD system (importJobs)...');
  const activeOldStatuses = ['queued', 'running', 'paused', 'cancelled', 'pending'];
  
  for (const status of activeOldStatuses) {
    const snap = await db.collection('importJobs').where('status', '==', status).get();
    console.log(`  ${status}: found ${snap.size} jobs`);
    
    for (const doc of snap.docs) {
      await db.collection('importJobs').doc(doc.id).update({
        status: 'cancelled',
        completedAt: new Date().toISOString(),
        cancelledAt: new Date().toISOString(),
        cancelledBy: 'admin-script',
      });
      totalKilled++;
    }
  }
  
  console.log(`\n✅ KILLED ${totalKilled} jobs`);
  
  // Verify
  console.log('\nStep 3: Verifying...');
  const verifyNew = await db.collection('import_jobs').get();
  const verifyOld = await db.collection('importJobs').get();
  
  const stillActiveNew = verifyNew.docs.filter(doc => 
    activeNewStatuses.includes(doc.data().status)
  );
  const stillActiveOld = verifyOld.docs.filter(doc => 
    activeOldStatuses.includes(doc.data().status)
  );
  
  console.log(`Active in NEW: ${stillActiveNew.length}`);
  console.log(`Active in OLD: ${stillActiveOld.length}`);
  
  if (stillActiveNew.length === 0 && stillActiveOld.length === 0) {
    console.log('\n🎉 WSZYSTKIE PROCESY ZABITE!');
  } else {
    console.log(`\n⚠️  Nadal ${stillActiveNew.length + stillActiveOld.length} aktywnych!`);
  }
  
  process.exit(0);
})();
