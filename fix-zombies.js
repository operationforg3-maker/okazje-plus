const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  console.log('=== Fixing zombie cancelled jobs in import_jobs ===\n');
  
  const cancelledSnap = await db.collection('import_jobs')
    .where('status', '==', 'cancelled')
    .get();
  
  console.log(`Found ${cancelledSnap.size} zombie jobs with status='cancelled'`);
  
  let fixed = 0;
  for (const doc of cancelledSnap.docs) {
    await db.collection('import_jobs').doc(doc.id).update({
      status: 'failed',
      fixedAt: new Date().toISOString(),
      note: 'Zombie job converted from cancelled to failed'
    });
    console.log(`Fixed: ${doc.id.slice(0, 8)}...`);
    fixed++;
  }
  
  console.log(`\n✅ Fixed ${fixed} zombie jobs`);
  process.exit(0);
})();
