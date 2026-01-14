import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus',
});

const db = admin.firestore();

async function check() {
  const dealsRef = db.collection('deals');
  const snap = await dealsRef.limit(3).get();
  
  console.log(`Total deals: ${snap.size}`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`\nDeal ${doc.id}:`);
    console.log(`  status: ${data.status}`);
    console.log(`  title: ${data.title?.substring(0, 50)}`);
  });
  
  // Check product_cores
  const productsRef = db.collection('product_cores');
  const prodSnap = await productsRef.limit(3).get();
  
  console.log(`\n\nTotal product_cores: ${prodSnap.size}`);
  prodSnap.forEach(doc => {
    const data = doc.data();
    console.log(`\nProduct ${doc.id}:`);
    console.log(`  status: ${data.status}`);
    console.log(`  title: ${data.title?.substring(0, 50)}`);
  });
}

check();
