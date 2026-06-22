const admin = require('firebase-admin');
const fs = require('fs');

const key = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('deals').limit(20).get();
  snap.docs.forEach(doc => {
    const d = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  price: ${JSON.stringify(d.price)} (type: ${typeof d.price})`);
    console.log(`  priceV2: ${JSON.stringify(d.priceV2)}`);
    console.log(`  legacyPrice: ${JSON.stringify(d.legacyPrice)}`);
    console.log(`  originalPrice: ${JSON.stringify(d.originalPrice)}`);
  });
})();
