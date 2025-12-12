const admin = require('firebase-admin');
const key = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(key) });
}

const db = admin.firestore();
const jobId = process.argv[2] || 'lNLdGDpnswtGObq9a9r0';

(async () => {
  console.log('\n📋 JOB DETAILS:', jobId);
  
  const doc = await db.collection('import_jobs').doc(jobId).get();
  if (!doc.exists) {
    console.log('❌ Job not found');
    process.exit(1);
  }
  
  const data = doc.data();
  console.log('Status:', data.status);
  console.log('Batches:', data.batches ? data.batches.length : 0);
  console.log('Logs:', (data.logs || []).length);
  
  if (data.batches && data.batches.length > 0) {
    console.log('\nFirst batch:');
    const b = data.batches[0];
    console.log('  Category:', b.categoryName, '/', b.subcategoryName, '/', b.subsubcategoryName);
    console.log('  Slug EN:', b.categorySlug, '/', b.subcategorySlug, '/', b.subsubcategorySlug);
    console.log('  Keywords:', b.importKeywords);
  }
  
  if (data.logs && data.logs.length > 0) {
    console.log('\nLogs:');
    data.logs.forEach(log => {
      console.log(`  [${log.timestamp}] ${log.message}`);
    });
  }
  
  process.exit(0);
})();
