import { adminDb } from '../src/lib/firebase-admin';

async function main() {
  const jobId = 'XfwOSCJb89VrAsCds1No';
  console.log(`Fetching Harvester Job: ${jobId}...`);
  const doc = await adminDb.collection('import_jobs').doc(jobId).get();
  if (doc.exists) {
    const data = doc.data() || {};
    console.log('Status:', data.status);
    console.log('Source:', data.source);
    console.log('Query:', data.query);
    console.log('Telemetry:', JSON.stringify(data.telemetry, null, 2));
    console.log('Logs (last 30):');
    const logs = data.logs || [];
    logs.slice(-30).forEach((l: any) => {
      console.log(`[${l.level}] ${l.message}`);
    });
  } else {
    console.error('Job not found');
  }
}

main().catch(console.error);
