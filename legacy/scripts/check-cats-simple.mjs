import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const allCats = await db.collection('categories').limit(50).get();
console.log(`\n📊 Total categories: ${allCats.size}\n`);

if (allCats.size > 0) {
  allCats.docs.forEach(doc => {
    const d = doc.data();
    const trans = d.translations ? JSON.stringify(d.translations) : 'null';
    console.log(`🔹 ${doc.id}`);
    console.log(`   name: ${d.name}`);
    console.log(`   depth: ${d.depth}, parent: ${d.parentSlug || 'null'}`);
    console.log(`   translations: ${trans}`);
    console.log('');
  });
}

process.exit(0);
