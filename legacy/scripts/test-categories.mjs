import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const categories = await db.collection('categories').get();
console.log('📚 Categories found:', categories.size);
categories.forEach(doc => {
  console.log(`  - ${doc.id}: ${doc.data().name || '(no name)'}`);
});

if (categories.size > 0) {
  const firstCat = categories.docs[0];
  const subs = await db.collection('categories').doc(firstCat.id).collection('subcategories').get();
  console.log(`\n  Subcategories of ${firstCat.data().name}:`, subs.size);
}
