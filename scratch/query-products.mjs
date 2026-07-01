import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
async function run() {
  const snapshot = await db.collection('product_cores').limit(1).get();
  snapshot.forEach(doc => {
    console.log(Object.keys(doc.data()));
  });
}
run();
