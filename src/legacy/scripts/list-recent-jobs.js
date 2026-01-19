const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

(async () => {
  console.log('\n📂 Recent import_jobs:');
  const snap = await db.collection('import_jobs')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
    
  if (snap.empty) {
    console.log('  No jobs found');
  } else {
    snap.forEach(doc => {
      const d = doc.data();
      console.log(`  ${doc.id}`);
      console.log(`    Status: ${d.status}`);
      console.log(`    Logs: ${(d.logs || []).length} entries`);
      console.log(`    Created: ${d.createdAt}`);
      console.log('');
    });
  }
  
  process.exit(0);
})();
