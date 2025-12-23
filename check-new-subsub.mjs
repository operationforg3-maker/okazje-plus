import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const subSubSnap = await db.collection('categories')
  .doc('electronics')
  .collection('subcategories')
  .doc('audio-video')
  .collection('subcategories')
  .get();

console.log(`\nSub-sub for audio-video (NEW): ${subSubSnap.size} items\n`);
subSubSnap.docs.forEach(doc => {
  const d = doc.data();
  console.log(`- ${doc.id}:`);
  console.log(`  name: ${d.name}`);
  console.log(`  translations: ${JSON.stringify(d.translations)}`);
});

process.exit(0);
