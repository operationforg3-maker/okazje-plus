import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Count products
const snap = await db.collection('products').limit(500).get();
console.log(`\n📦 Total products in Firestore: ${snap.size}`);

if (snap.size > 0) {
  console.log(`\n🎯 Sample products (first 5):`);
  snap.docs.slice(0, 5).forEach((doc, i) => {
    const p = doc.data();
    console.log(`\n  ${i+1}. ${p.title?.slice(0, 60)}`);
    console.log(`     Price: $${p.price} PLN ${p.pricePolishCurrency}`);
    console.log(`     Rating: ${p.rating} ⭐ (${p.orders} orders)`);
    console.log(`     Category: ${p.categoryName}/${p.subcategoryName}`);
  });
}
