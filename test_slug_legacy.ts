import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: 'okazje-plus' });
}
const db = getFirestore();

async function run() {
  const q2 = await db.collection('products').limit(5).get();
  q2.forEach(d => {
    console.log(d.id, "slug:", typeof d.data().slug, d.data().slug);
  });
}
run().catch(console.error);
