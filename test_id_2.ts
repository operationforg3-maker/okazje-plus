import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: 'okazje-plus' });
}
const db = getFirestore();

async function run() {
  const docs = await db.collection('product_cores').limit(5).get();
  docs.forEach(doc => console.log(doc.id));
}
run().catch(console.error);
