import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  console.log('\n🔎 Listing recent harvester_jobs (last 10):');
  const snap = await db.collection('harvester_jobs')
    .orderBy('lastUpdatedAt', 'desc')
    .limit(50)
    .get();

  if (snap.empty) {
    console.log('No harvester_jobs found.');
    return;
  }

  for (const doc of snap.docs) {
    const j = doc.data();
    console.log(`\n🪄 Job ${j.id || doc.id}`);
    console.log(`  Status: ${j.status}`);
    console.log(`  Source: ${j.source}`);
    console.log(`  Query: ${j.query}`);
    console.log(`  Products Found: ${j.productsFound}`);
    console.log(`  Products Created: ${j.productsCreated}`);
    console.log(`  Deals Created: ${j.dealsCreated}`);
    console.log(`  Duplicates Skipped: ${j.duplicatesSkipped}`);
    console.log(`  Started: ${j.startedAt}`);
    console.log(`  Last Updated: ${j.lastUpdatedAt}`);
  }
}

main().catch(err => {
  console.error('Failed to list harvester jobs:', err);
  process.exit(1);
});
