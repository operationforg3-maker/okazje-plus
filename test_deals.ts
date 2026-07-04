import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: 'okazje-plus' });
}
const db = getFirestore();

async function run() {
  const snap = await db.collection('deals').where('productCoreId', '==', '0HSGNhijqZd4LajYXQio').get();
  snap.forEach(d => {
    console.log("deal:", d.id);
    console.log("  price:", d.data().price);
    console.log("  shipping:", d.data().shipping);
    console.log("  shippingCost:", d.data().shippingCost);
    console.log("  freeShipping:", d.data().freeShipping);
  });
}
run().catch(console.error);
