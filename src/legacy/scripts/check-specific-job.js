const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const jobId = process.argv[2] || 'qGm1xGc5OEjBMSr4ifB4';

(async () => {
  console.log('\n🔍 Checking job:', jobId);
  
  const doc = await db.collection('import_jobs').doc(jobId).get();
  if (!doc.exists) {
    console.log('❌ Job not found');
    process.exit(1);
  }
  
  const data = doc.data();
  console.log('\n📋 STATUS:', data.status);
  console.log('📅 Created:', data.createdAt);
  console.log('📊 Progress:', JSON.stringify(data.progress || {}));
  
  console.log('\n📝 LOGS:', (data.logs || []).length, 'entries');
  if (data.logs && data.logs.length > 0) {
    console.log('Recent logs:');
    data.logs.slice(-8).forEach(log => {
      console.log(`  [${log.timestamp}] ${log.message}`);
      if (log.details) console.log('    →', JSON.stringify(log.details));
    });
  } else {
    console.log('  ⚠️  No logs found');
  }
  
  const prods = await db.collection('products')
    .where('importJobId', '==', jobId)
    .limit(10)
    .get();
    
  console.log('\n💾 PRODUCTS SAVED:', prods.size);
  if (!prods.empty) {
    prods.forEach(p => {
      const prod = p.data();
      console.log(`  ✓ ${p.id}: ${prod.name || prod.title?.pl || 'Unnamed'}`);
    });
  }
  
  process.exit(0);
})();
