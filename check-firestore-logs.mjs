import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

console.log('🔍 Checking Firestore collections and documents...\n');

// Check import_jobs
const importJobs = await db.collection('import_jobs').limit(5).get();
console.log(`📦 import_jobs collection: ${importJobs.size} documents`);
importJobs.forEach(doc => {
  const data = doc.data();
  console.log(`\n  Job ID: ${doc.id}`);
  console.log(`  Status: ${data.status}`);
  console.log(`  Type: ${data.type}`);
  console.log(`  Batches: ${data.batches?.length || 0}`);
  console.log(`  Logs: ${data.logs?.length || 0}`);
  console.log(`  Progress:`, data.progress);
});

// Check categories
const categories = await db.collection('categories').get();
console.log(`\n\n📚 categories collection: ${categories.size} documents`);

// Check if there's any initialization data
const config = await db.collection('config').get();
console.log(`\n⚙️ config collection: ${config.size} documents`);
config.forEach(doc => {
  console.log(`  - ${doc.id}`);
});
