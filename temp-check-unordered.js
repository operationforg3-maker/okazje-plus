const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  console.log('Checking recent jobs (unordered)...');
  try {
    const jobs = await db.collection('import_jobs').limit(10).get();
    if (jobs.empty) {
        console.log("No jobs found.");
        return;
    }
    
    jobs.forEach(doc => {
        const d = doc.data();
        console.log(`Job [${doc.id}] Status: ${d.status}, Started: ${d.startedAt}`);
    });
  } catch(e) {
      console.error(e);
  }
}
check();
