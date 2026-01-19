// check-latest-import.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function checkLatest() {
  console.log('🔍 Checking latest import job in detail...\n');

  try {
    // Get latest job
    const jobSnapshot = await db.collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (jobSnapshot.empty) {
      console.log('❌ No import jobs found');
      process.exit(0);
    }

    const jobDoc = jobSnapshot.docs[0];
    const jobData = jobDoc.data();

    console.log(`📋 Job ID: ${jobDoc.id}`);
    console.log(`Status: ${jobData.status}`);
    console.log(`Type: ${jobData.type}`);
    console.log(`Importer: ${jobData.importerType}`);
    console.log(`Created: ${jobData.createdAt}`);
    console.log(`Progress: ${JSON.stringify(jobData.progress)}\n`);

    console.log(`📝 Full logs (last 10):`);
    if (jobData.logs && Array.isArray(jobData.logs)) {
      const lastLogs = jobData.logs.slice(-10);
      lastLogs.forEach((log, idx) => {
        if (typeof log === 'object') {
          console.log(`${idx + 1}. [${log.timestamp}] ${log.batchIndex ? `Batch ${log.batchIndex}:` : ''} ${log.message || log.status || 'N/A'}`);
          if (log.stages) {
            console.log(`   Stages: fetched=${log.stages.fetched}, dedup=${log.stages.deduplicated}, enrich=${log.stages.enriched}, translate=${log.stages.translated}, save=${log.stages.saved}`);
          }
          if (log.error) {
            console.log(`   ❌ Error: ${log.error}`);
          }
        }
      });
    }

    console.log(`\n📊 Summary:`);
    console.log(`Items Created: ${jobData.itemsCreated?.length || 0}`);
    console.log(`Items Updated: ${jobData.itemsUpdated?.length || 0}`);
    console.log(`Batches: ${jobData.batches?.length || 0}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

checkLatest();
