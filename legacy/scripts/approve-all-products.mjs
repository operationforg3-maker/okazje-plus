import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function approveAll() {
  console.log('🚀 Approving all ProductCores...\n');
  
  const snapshot = await db.collection('product_cores')
    .where('status', '!=', 'approved')
    .get();
  
  console.log(`Found ${snapshot.size} products to approve\n`);
  
  let approved = 0;
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchDocs = snapshot.docs.slice(i, i + BATCH_SIZE);
    
    for (const doc of batchDocs) {
      batch.update(doc.ref, {
        status: 'approved',
        updatedAt: new Date().toISOString(),
      });
      approved++;
    }
    
    await batch.commit();
    console.log(`✅ Approved: ${approved}/${snapshot.size}`);
  }
  
  console.log(`\n🎉 All ${approved} products are now approved!`);
}

approveAll()
  .catch(console.error)
  .finally(() => admin.app().delete());
