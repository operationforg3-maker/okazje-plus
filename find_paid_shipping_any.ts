import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: 'okazje-plus' });
}
const db = getFirestore();

async function run() {
  // Query by shippingCost descending
  const snap1 = await db.collection('deals')
    .orderBy('shippingCost', 'desc')
    .limit(10)
    .get();
  
  console.log("Deals with shippingCost > 0:");
  for (const doc of snap1.docs) {
    const data = doc.data();
    console.log(`  Deal ID: ${doc.id}, Product ID: ${data.productCoreId}, Cost: ${data.shippingCost}`);
    if (data.productCoreId) {
      const pc = await db.collection('product_cores').doc(data.productCoreId).get();
      if (pc.exists) {
        console.log(`    Product Slug:`, pc.data().slug?.pl || pc.data().slug);
      }
    }
  }

  // Query by shipping.cost descending
  const snap2 = await db.collection('deals')
    .orderBy('shipping.cost', 'desc')
    .limit(10)
    .get();

  console.log("Deals with shipping.cost > 0:");
  for (const doc of snap2.docs) {
    const data = doc.data();
    console.log(`  Deal ID: ${doc.id}, Product ID: ${data.productCoreId}, Cost: ${data.shipping?.cost}`);
    if (data.productCoreId) {
      const pc = await db.collection('product_cores').doc(data.productCoreId).get();
      if (pc.exists) {
        console.log(`    Product Slug:`, pc.data().slug?.pl || pc.data().slug);
      }
    }
  }
}
run().catch(console.error);
