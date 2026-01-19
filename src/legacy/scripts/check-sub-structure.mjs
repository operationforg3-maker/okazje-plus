import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// Check subcategories structure
const mainDoc = await db.collection('categories').doc('electronics').get();
if (mainDoc.exists) {
  console.log('\n🔍 Main: electronics');
  console.log(JSON.stringify(mainDoc.data(), null, 2));
  
  const subSnap = await db.collection('categories').doc('electronics').collection('subcategories').get();
  console.log(`\n📊 Subcategories count: ${subSnap.size}`);
  
  subSnap.docs.slice(0, 3).forEach(doc => {
    const d = doc.data();
    console.log(`\n🔹 Sub: ${doc.id}`);
    console.log(`   name: ${d.name}`);
    console.log(`   translations: ${JSON.stringify(d.translations)}`);
  });
  
  if (subSnap.size > 0) {
    const firstSub = subSnap.docs[0];
    const subSubSnap = await db.collection('categories')
      .doc('electronics')
      .collection('subcategories')
      .doc(firstSub.id)
      .collection('subcategories')
      .get();
    
    console.log(`\n📊 Sub-sub categories (${firstSub.id}): ${subSubSnap.size}`);
    subSubSnap.docs.slice(0, 3).forEach(doc => {
      const d = doc.data();
      console.log(`\n  🔸 ${doc.id}: ${d.name}`);
      console.log(`     translations: ${JSON.stringify(d.translations)}`);
    });
  }
}

process.exit(0);
