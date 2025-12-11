const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  const jobs = await db.collection('import_jobs')
    .where('status', '==', 'running')
    .limit(10)
    .get();
  
  console.log('\n=== RUNNING IMPORT JOBS ===');
  console.log(`Found ${jobs.size} running jobs\n`);
  
  jobs.forEach(doc => {
    const data = doc.data();
    console.log(`Job ID: ${doc.id}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Progress: ${data.progress?.completed || 0}/${data.progress?.total || 0} (current: ${data.progress?.current || 0})`);
    console.log(`  Started: ${data.startedAt}`);
    console.log(`  Type: ${data.type}, Importer: ${data.importerType}`);
    console.log('');
  });
  
  // Check products count
  const productsSnap = await db.collection('products').limit(10).get();
  console.log(`\n=== PRODUCTS ===`);
  console.log(`Sample count: ${productsSnap.size} products found`);
  
  process.exit(0);
})();
