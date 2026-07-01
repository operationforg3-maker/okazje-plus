import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

if (!initializeApp.length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('products').limit(5).get();
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(doc.id);
    console.log("image:", data.image);
    console.log("images:", data.images);
    console.log("gallery:", data.gallery);
  });
}
run();
