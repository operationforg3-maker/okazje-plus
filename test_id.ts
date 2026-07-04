import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: 'okazje-plus' });
}
const db = getFirestore();

async function run() {
  const d1 = await db.collection('product_cores').doc('92mf-efficient-bottle-brush-for-blenders-processors-flexible-bristles-cleaner').get();
  console.log("product_cores doc exists:", d1.exists);

  const d2 = await db.collection('products').doc('92mf-efficient-bottle-brush-for-blenders-processors-flexible-bristles-cleaner').get();
  console.log("products doc exists:", d2.exists);
}
run().catch(console.error);
