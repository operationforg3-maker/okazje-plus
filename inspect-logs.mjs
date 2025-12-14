import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const jobId = 'sqejGVfBGUcUs2XlTO4e';
const job = await db.collection('import_jobs').doc(jobId).get();

if (job.exists) {
  const data = job.data();
  console.log(`\n🔍 DETAILED LOG INSPECTION:\n`);
  
  if (data.logs) {
    data.logs.slice(5).forEach((log, idx) => {
      console.log(`\nLog ${idx + 6}:`);
      console.log(JSON.stringify(log, null, 2));
    });
  }
}
