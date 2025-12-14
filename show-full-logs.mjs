import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const jobId = 'aBMf0nMQ7s38WzlpfmKS';
const job = await db.collection('import_jobs').doc(jobId).get();

if (job.exists) {
  const data = job.data();
  console.log(`\n📊 JOB: ${jobId}`);
  console.log(`Status: ${data.status}`);
  console.log(`Total logs: ${data.logs?.length || 0}\n`);
  
  if (data.logs) {
    data.logs.forEach((log, i) => {
      const time = log.timestamp ? log.timestamp.split('T')[1].split('.')[0] : '??:??:??';
      if (log.message) {
        console.log(`${String(i+1).padStart(2, ' ')}. [${time}] ${log.message}`);
      } else if (log.status) {
        console.log(`${String(i+1).padStart(2, ' ')}. [${time}] STATUS: ${log.status} | saved: ${log.stages?.saved} | skipped: ${log.itemsSkipped}`);
      }
    });
  }
}
