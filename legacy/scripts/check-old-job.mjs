import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const jobId = 'sqejGVfBGUcUs2XlTO4e';
const job = await db.collection('import_jobs').doc(jobId).get();

if (job.exists) {
  const data = job.data();
  console.log(`\n📊 OLD JOB: ${jobId}`);
  console.log(`Status: ${data.status}`);
  console.log(`Progress: ${data.progress?.completed}/${data.progress?.total}`);
  
  // Find batch results
  const logs = data.logs || [];
  logs.forEach((log, i) => {
    if (log.status === 'success' && log.stages) {
      console.log(`\nBatch: ${log.subcategory}`);
      console.log(`  Fetched: ${log.stages.fetched}`);
      console.log(`  Deduped: ${log.stages.deduplicated}`);
      console.log(`  Enriched: ${log.stages.enriched}`);
      console.log(`  Translated: ${log.stages.translated}`);
      console.log(`  SAVED: ${log.stages.saved} ← KEY!`);
      console.log(`  Skipped: ${log.itemsSkipped}`);
    }
  });
}
