const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus'
});

const db = admin.firestore();

async function check() {
  const jobId = 'RlCb3td6ombU4EPk1Soz';
  
  const batchesSnapshot = await db.collection('import_jobs').doc(jobId)
    .collection('batches').limit(3).get();
  
  console.log(`Found ${batchesSnapshot.size} batches\n`);
  
  batchesSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Batch ${doc.id}:`);
    console.log('  Status:', data.status);
    console.log('  Stats:', data.stats);
    console.log('');
  });
  
  admin.app().delete();
  process.exit(0);
}

check().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
