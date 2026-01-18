import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' assert { type: 'json' };

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
});

// Check if there's a data field or productIds
if (job.stats) {
  console.log('\n📊 STATS:', job.stats);
}

if (job.data) {
  console.log('\n📦 DATA (first 5):', job.data.slice(0, 5));
}

process.exit(0);
