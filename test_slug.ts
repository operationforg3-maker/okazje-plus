import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: 'okazje-plus' });
}
const db = getFirestore();

async function run() {
  const q1 = await db.collection('product_cores').where('slug', '==', '92mf-efficient-bottle-brush-for-blenders-processors-flexible-bristles-cleaner').get();
  console.log("product_cores slug:", q1.empty ? "empty" : q1.docs[0].id);

  const q2 = await db.collection('products').where('slug', '==', '92mf-efficient-bottle-brush-for-blenders-processors-flexible-bristles-cleaner').get();
  console.log("products slug:", q2.empty ? "empty" : q2.docs[0].id);
}
run().catch(console.error);
