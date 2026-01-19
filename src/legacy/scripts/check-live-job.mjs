import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const jobId = 'aBMf0nMQ7s38WzlpfmKS';
const job = await db.collection('import_jobs').doc(jobId).get();

if (job.exists) {
  const data = job.data();
  console.log(`\n📋 NEW JOB: ${jobId}`);
  console.log(`Status: ${data.status}`);
  console.log(`Importer: ${data.importerType}`);
  console.log(`Progress: ${data.progress.completed}/${data.progress.total} (current: batch ${data.progress.current})`);
  console.log(`Logs: ${data.logs?.length || 0}`);
  
  if (data.logs && data.logs.length > 0) {
    console.log(`\nLogs (last 10):`);
    data.logs.slice(-10).forEach((log, i) => {
      if (log.message) {
        console.log(`  ${i+1}. [${log.timestamp.split('T')[1].split('.')[0]}] ${log.message}`);
      } else if (log.details) {
        console.log(`  ${i+1}. [${log.timestamp.split('T')[1].split('.')[0]}] ${JSON.stringify(log.details)}`);
      }
    });
  }
} else {
  console.log('❌ Job not found');
}
