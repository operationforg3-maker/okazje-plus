const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus'
});

const db = admin.firestore();

async function check() {
  console.log('=== NEW JOB STATUS ===');
  const job = await db.collection('import_jobs').doc('EgLY2P8qBjyFXeAhbKM2').get();
  
  if (job.exists) {
    const data = job.data();
    console.log('Status:', data.status);
    console.log('Stats:', data.stats);
    console.log('\nFirst 5 batches:');
    
    const batches = await db.collection('import_jobs').doc('EgLY2P8qBjyFXeAhbKM2')
      .collection('batches').limit(5).get();
    
    batches.forEach(b => {
      const bd = b.data();
      console.log(`  Batch ${b.id}: status=${bd.status}, stats=${JSON.stringify(bd.stats)}`);
    });
  } else {
    console.log('Job not found');
  }
  
  admin.app().delete();
  process.exit(0);
}

check().catch(err => { console.error(err.message); process.exit(1); });
