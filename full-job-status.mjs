import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const jobId = 'sqejGVfBGUcUs2XlTO4e';
const job = await db.collection('import_jobs').doc(jobId).get();

if (job.exists) {
  const data = job.data();
  console.log(`\n📊 JOB FULL STATUS: ${jobId}`);
  console.log(`Status: ${data.status}`);
  console.log(`Progress: ${JSON.stringify(data.progress)}`);
  console.log(`Total logs: ${data.logs?.length || 0}\n`);
  
  if (data.logs) {
    console.log('📝 ALL LOGS:');
    data.logs.forEach((log, i) => {
      const time = log.timestamp ? log.timestamp.split('T')[1].split('.')[0] : '??:??:??';
      console.log(`${i+1}. [${time}] ${log.message || JSON.stringify(log.details).slice(0, 100)}`);
    });
  }
}
