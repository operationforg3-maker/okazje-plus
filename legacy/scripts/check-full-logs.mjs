import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function checkFullLogs() {
  try {
    // Get all running jobs (limit 1)
    const jobsSnapshot = await db.collection('import_jobs')
      .where('status', '==', 'running')
      .limit(1)
      .get();

    if (jobsSnapshot.empty) {
      console.log('❌ No running jobs found');
      process.exit(0);
    }

    const job = jobsSnapshot.docs[0];
    const data = job.data();

    console.log(`\n📌 JOB: ${job.id}`);
    console.log(`Importer: ${data.importerType}`);
    console.log(`Status: ${data.status}`);
    console.log(`Progress: ${data.progress?.completed}/${data.progress?.total} batches (current: ${data.progress?.current})`);
    console.log(`Items Created: ${data.itemsCreated?.length || 0}`);
    console.log(`Items Updated: ${data.itemsUpdated?.length || 0}`);
    console.log(`Last Updated: ${data.updatedAt}\n`);

    if (data.logs && data.logs.length > 0) {
      console.log(`📝 LOGS (${data.logs.length} total):\n`);
      
      // Show last 30 logs
      const logsToShow = data.logs.slice(-30);
      logsToShow.forEach((log, idx) => {
        const prefix = (idx === logsToShow.length - 1) ? '▶' : ' ';
        if (typeof log === 'object') {
          if (log.message) {
            console.log(`${prefix} [${log.timestamp}] ${log.message}`);
            if (log.details) console.log(`     Details: ${JSON.stringify(log.details)}`);
          } else if (log.batchIndex !== undefined) {
            console.log(`${prefix} [${log.timestamp}] Batch ${log.batchIndex}: ${log.subcategory}`);
            console.log(`     Status: ${log.status}, Fetched: ${log.stages?.fetched || 0}, Saved: ${log.stages?.saved || 0}`);
            if (log.error) console.log(`     ERROR: ${log.error}`);
          }
        } else {
          console.log(`${prefix} ${log}`);
        }
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

checkFullLogs();
