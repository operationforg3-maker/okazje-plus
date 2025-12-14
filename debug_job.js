const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus'
});

const db = admin.firestore();

async function debug() {
  const jobId = 'RlCb3td6ombU4EPk1Soz';
  const jobDoc = await db.collection('import_jobs').doc(jobId).get();
  
  if (!jobDoc.exists) {
    console.log('Job not found');
    process.exit(0);
  }
  
  const data = jobDoc.data();
  console.log('Job Document:');
  console.log(JSON.stringify(data, null, 2));
  
  // Check subcollections
  console.log('\nSubcollections:');
  const subcols = await db.collection('import_jobs').doc(jobId).listCollections();
  subcols.forEach(col => console.log('  -', col.id));
  
  admin.app().delete();
  process.exit(0);
}

debug().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
