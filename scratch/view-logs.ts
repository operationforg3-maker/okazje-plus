import { adminDb } from '../src/lib/firebase-admin';

async function viewLogs() {
  const jobId = 'harvest_1781722981018_iy4wl';
  console.log(`Logs for job: ${jobId}`);
  try {
    const doc = await adminDb.collection('harvester_jobs').doc(jobId).get();
    if (!doc.exists) {
      console.log('Not found');
      return;
    }
    const data = doc.data();
    console.log(`Status: ${data.status}`);
    console.log(`Errors:`, JSON.stringify(data.errors, null, 2));
    console.log('Logs:');
    data.logs?.forEach((l: any) => {
      console.log(`[${l.timestamp}] [${l.level}] ${l.message}`);
    });
  } catch (err) {
    console.error(err);
  }
}

viewLogs();
