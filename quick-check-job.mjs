const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const jobId = process.argv[2] || 'GT5O9x6mjnu2QjruObOu';
const jobRef = db.collection('import_jobs').doc(jobId);

const jobSnap = await jobRef.get();
if (!jobSnap.exists) {
  console.log('❌ Job not found');
  process.exit(1);
}

const job = jobSnap.data();
console.log('📋 JOB:', {
  status: job.status,
  created: job.createdAt,
  stats: job.stats,
  profile: job.profile,
  logsCount: job.logs?.length || 0,
});

if (job.stats) {
  console.log('\n📊 STATS:', job.stats);
}

// Check deals collection
const dealsSnap = await db.collection('deals').limit(3).get();
console.log('\n🔗 DEALS in DB:', dealsSnap.size, 'total');
dealsSnap.docs.forEach(doc => {
  const deal = doc.data();
  console.log(`  - ${deal.merchantName}: ${deal.price?.amount || deal.priceV2?.amount || deal.legacyPrice || '?'}`);
});

// Check product_cores collection
const productsSnap = await db.collection('product_cores').limit(3).get();
console.log('\n📦 PRODUCTS in DB:', productsSnap.size, 'total');
productsSnap.docs.forEach(doc => {
  const prod = doc.data();
  console.log(`  - ${prod.title?.substring(0, 30)}: bestPrice=${prod.bestPrice?.amount || 0}`);
});

process.exit(0);

