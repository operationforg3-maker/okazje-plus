import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function checkCategories() {
  console.log('=== MAIN CATEGORIES ===');
  const snap = await db.collection('categories').limit(5).get();
  
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log(`\nID: ${doc.id}`);
    console.log(`Name: ${data.name}`);
    console.log(`Slug: ${data.slug}`);
    
    // Check subcategories
    const subsSnap = await db.collection('categories').doc(doc.id).collection('subcategories').limit(2).get();
    if (!subsSnap.empty) {
      console.log(`Subcategories (${subsSnap.size}):`);
      subsSnap.docs.forEach(subdoc => {
        const subdata = subdoc.data();
        console.log(`  - ${subdata.name} (${subdata.slug})`);
      });
    }
  }
}

checkCategories().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
