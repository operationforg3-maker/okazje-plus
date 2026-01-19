import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const jobId = 'sqejGVfBGUcUs2XlTO4e';
const job = await db.collection('import_jobs').doc(jobId).get();

if (job.exists) {
  const data = job.data();
  console.log(`📋 Job: ${jobId}`);
  console.log(`Status: ${data.status}`);
  console.log(`Importer: ${data.importerType}`);
  console.log(`Progress: ${data.progress.completed}/${data.progress.total}`);
  console.log(`Current batch: ${data.progress.current}`);
  console.log(`Logs: ${data.logs?.length || 0}`);
  
  if (data.logs && data.logs.length > 0) {
    console.log(`\nLast 5 logs:`);
    data.logs.slice(-5).forEach((log, i) => {
      console.log(`  ${i+1}. [${log.timestamp}] ${log.message}`);
    });
  }
} else {
  console.log('❌ Job not found');
}
