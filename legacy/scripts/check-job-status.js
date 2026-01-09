const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

(async () => {
  const jobId = '8XSqBwLerSKW4waEqfjW';
  
  const doc = await db.collection('import_jobs').doc(jobId).get();
  if (!doc.exists) {
    console.log('❌ Job not found:', jobId);
    return;
  }
  
  const data = doc.data();
  console.log('\n📋 JOB STATUS:', jobId);
  console.log('Status:', data.status);
  console.log('Created:', data.createdAt);
  console.log('Progress:', JSON.stringify(data.progress || {}, null, 2));
  console.log('Logs:');
  if (data.logs && data.logs.length > 0) {
    data.logs.slice(-10).forEach(log => {
      console.log(`  [${log.timestamp}] ${log.message}`);
      if (log.details) console.log('    Details:', JSON.stringify(log.details));
    });
  } else {
    console.log('  (No logs yet)');
  }
  
  // Check products
  const productsSnap = await db.collection('products')
    .where('importJobId', '==', jobId)
    .limit(10)
    .get();
    
  console.log('\n💾 PRODUCTS SAVED:', productsSnap.size);
  if (!productsSnap.empty) {
    productsSnap.forEach(p => {
      const prod = p.data();
      console.log(`  - ${p.id}: ${prod.name || prod.title?.pl || 'Unnamed'}`);
    });
  }
  
  process.exit(0);
})();
