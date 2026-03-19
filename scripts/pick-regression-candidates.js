const admin = require('firebase-admin');
const fs = require('fs');

const key = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

(async () => {
  const deals = await db.collection('deals').where('status', '==', 'approved').limit(1000).get();

  const counts = new Map();
  for (const d of deals.docs) {
    const data = d.data() || {};
    if (data.isActive === false) continue;
    const pid = data.productCoreId || data.productId;
    if (!pid) continue;
    counts.set(pid, (counts.get(pid) || 0) + 1);
  }

  const productIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map((x) => x[0]);

  const out = [];
  for (const id of productIds) {
    const p = await db.collection('product_cores').doc(id).get();
    const d = p.data() || {};
    if (!p.exists) continue;
    if (d.status !== 'approved') continue;

    out.push({
      id,
      dealCount: counts.get(id) || 0,
      title: (d.title?.pl || d.title?.en || '').slice(0, 120),
    });
  }

  console.log(JSON.stringify(out.slice(0, 4), null, 2));
})();
