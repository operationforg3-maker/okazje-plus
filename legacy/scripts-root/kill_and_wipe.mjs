import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Admin SDK
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function killAll() {
  const running = await db.collection('harvester_jobs').where('status', '==', 'running').get();
  let killed = 0;
  const batch = db.batch();
  running.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'paused',
      completedAt: new Date().toISOString(),
    });
    killed += 1;
  });
  if (killed > 0) await batch.commit();
  return killed;
}

async function deleteCollection(colName) {
  const pageSize = 300;
  let total = 0;
  while (true) {
    const snap = await db.collection(colName).limit(pageSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
  return total;
}

async function wipeAll() {
  const deleted = {};
  deleted.deals = await deleteCollection('deals');
  deleted.product_cores = await deleteCollection('product_cores');
  deleted.identity_matches = await deleteCollection('identity_matches');
  deleted.harvester_jobs = await deleteCollection('harvester_jobs');
  const total = Object.values(deleted).reduce((a, b) => a + b, 0);
  return { deleted, total };
}

(async () => {
  const arg = process.argv[2];
  if (!arg || !['kill', 'wipe', 'all'].includes(arg)) {
    console.log('Usage: node scripts/kill_and_wipe.mjs <kill|wipe|all>');
    process.exit(1);
  }
  if (arg === 'kill' || arg === 'all') {
    const killed = await killAll();
    console.log(`Killed running jobs: ${killed}`);
  }
  if (arg === 'wipe' || arg === 'all') {
    const res = await wipeAll();
    console.log(`WIPE done. Total deleted: ${res.total}`);
    console.log(res);
  }
  process.exit(0);
})();
