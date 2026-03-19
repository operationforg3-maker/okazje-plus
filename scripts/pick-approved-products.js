const admin = require('firebase-admin');
const fs = require('fs');

const key = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('product_cores').where('status', '==', 'approved').limit(20).get();
  const out = [];
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    out.push({
      id: doc.id,
      title: (d.title?.pl || d.title?.en || '').slice(0, 120),
      bestDealId: d.bestDealId || null,
      bestPrice: d.bestPrice || null,
    });
  }
  console.log(JSON.stringify(out.slice(0, 4), null, 2));
})();
