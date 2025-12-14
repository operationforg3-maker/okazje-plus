#!/usr/bin/env node
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('Missing serviceAccountKey.json');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))),
});

const db = admin.firestore();

function addStats(agg, s) {
  if (!s) return;
  for (const [k, v] of Object.entries(s)) {
    agg[k] = (agg[k] || 0) + (typeof v === 'number' ? v : 0);
  }
}

async function run() {
  console.log('=== Import Jobs Stage Summary ===');
  const jobsSnap = await db.collection('import_jobs')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  if (jobsSnap.empty) {
    console.log('No jobs found');
    return;
  }

  for (const jobDoc of jobsSnap.docs) {
    const job = jobDoc.data();
    console.log(`\nJob ${jobDoc.id}: status=${job.status}, type=${job.type}, batches=${job.totalBatches}`);
    const batchesSnap = await db.collection('import_jobs').doc(jobDoc.id).collection('batches').limit(200).get();
    let aggStages = { fetched: 0, deduplicated: 0, enriched: 0, translated: 0, saved: 0 };
    let itemsAdded = 0, itemsUpdated = 0, itemsSkipped = 0;
    let success = 0, failed = 0, running = 0;

    for (const b of batchesSnap.docs) {
      const data = b.data();
      addStats(aggStages, data.stages);
      itemsAdded += data.itemsAdded || 0;
      itemsUpdated += data.itemsUpdated || 0;
      itemsSkipped += data.itemsSkipped || 0;
      if (data.status === 'success') success++; else if (data.status === 'failed') failed++; else running++;
    }

    console.log(`  Batches summary: success=${success}, failed=${failed}, running=${running}`);
    console.log(`  Stage totals (first 50 batches): fetched=${aggStages.fetched}, dedup=${aggStages.deduplicated}, enrich=${aggStages.enriched}, translate=${aggStages.translated}, saved=${aggStages.saved}`);
    console.log(`  Items: added=${itemsAdded}, updated=${itemsUpdated}, skipped=${itemsSkipped}`);
  }

  await admin.app().delete();
}

run().catch(err => { console.error(err); process.exit(1); });
