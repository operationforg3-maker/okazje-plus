import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function checkStatuses() {
  console.log('📊 Checking ProductCore statuses...\n');
  
  const snapshot = await db.collection('product_cores').get();
  
  const stats = {};
  snapshot.forEach(doc => {
    const status = doc.data().status || 'unknown';
    stats[status] = (stats[status] || 0) + 1;
  });
  
  console.log('Status breakdown:');
  for (const [status, count] of Object.entries(stats)) {
    console.log(`  ${status}: ${count}`);
  }
  
  console.log(`\nTotal: ${snapshot.size}`);
}

checkStatuses()
  .catch(console.error)
  .finally(() => admin.app().delete());
