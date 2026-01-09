import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

console.log('\n🔴 KILL ALL + WIPE OPERATION\n');

// 1. Kill all running jobs
console.log('Step 1: Killing all running harvester jobs...');
const jobsSnap = await db.collection('harvester_jobs')
  .where('status', '==', 'running')
  .get();

let killedCount = 0;
for (const doc of jobsSnap.docs) {
  await doc.ref.update({
    status: 'paused',
    updatedAt: new Date().toISOString(),
    logs: admin.firestore.FieldValue.arrayUnion({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Job killed by admin',
    }),
  });
  killedCount++;
}
console.log(`✅ Killed ${killedCount} running jobs\n`);

// 2. Wipe all data collections
console.log('Step 2: Wiping database...');
const collections = ['deals', 'product_cores', 'identity_matches', 'harvester_jobs'];
const results = {};

for (const collectionName of collections) {
  let deleted = 0;
  const collectionRef = db.collection(collectionName);
  
  let hasMore = true;
  while (hasMore) {
    const snapshot = await collectionRef.limit(100).get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    deleted += snapshot.docs.length;
    process.stdout.write(`\r  ${collectionName}: ${deleted} deleted...`);
  }
  
  results[collectionName] = deleted;
  console.log(`\r✅ ${collectionName}: ${deleted} deleted`);
}

const total = Object.values(results).reduce((sum, count) => sum + count, 0);

console.log('\n📊 WIPE SUMMARY:');
console.log(`  - Deals: ${results.deals}`);
console.log(`  - Product Cores: ${results.product_cores}`);
console.log(`  - Identity Matches: ${results.identity_matches}`);
console.log(`  - Harvester Jobs: ${results.harvester_jobs}`);
console.log(`  📦 TOTAL: ${total} documents deleted\n`);

console.log('✅ Operation completed!\n');
process.exit(0);
