const admin = require('firebase-admin');
const fs = require('fs');

const key = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

async function run() {
  const productId = process.argv[2];
  if (!productId) {
    throw new Error('Usage: node scripts/fix-product-offers-status.js <productId>');
  }

  const productRef = db.collection('product_cores').doc(productId);
  const productSnap = await productRef.get();

  if (!productSnap.exists) {
    throw new Error(`Product not found: ${productId}`);
  }

  const product = productSnap.data() || {};
  if (product.status !== 'approved') {
    throw new Error(`Product status is ${product.status}, expected approved`);
  }

  const dealsSnap = await db.collection('deals').where('productCoreId', '==', productId).get();
  if (dealsSnap.empty) {
    console.log('No deals found for product');
    return;
  }

  const upgradeStatuses = new Set(['poczekalnia', 'pending', 'pending_approval', 'approval']);
  const now = new Date().toISOString();

  const toApprove = dealsSnap.docs.filter((doc) => {
    const d = doc.data() || {};
    return Boolean(d.isActive) && upgradeStatuses.has(String(d.status || ''));
  });

  const batch = db.batch();
  for (const doc of toApprove) {
    batch.update(doc.ref, {
      status: 'approved',
      lifecycleStatus: 'active',
      updatedAt: now,
    });
  }

  await batch.commit();

  const approvedSnap = await db
    .collection('deals')
    .where('productCoreId', '==', productId)
    .where('status', '==', 'approved')
    .where('isActive', '==', true)
    .get();

  const approvedDeals = approvedSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

  if (approvedDeals.length === 0) {
    await productRef.update({
      bestPrice: { amount: 0, currency: 'PLN' },
      bestTotalPrice: null,
      bestDealId: null,
      linkedDealIds: [],
      updatedAt: now,
    });

    console.log(JSON.stringify({
      productId,
      approvedDeals: 0,
      promotedDeals: toApprove.length,
      bestDealId: null,
      bestTotalPrice: null,
    }, null, 2));
    return;
  }

  const bestDeal = approvedDeals.reduce((best, current) => {
    const bestTotal = Number(best.price?.amount || best.price || 0) + Number(best.shipping?.cost || best.shippingCost || 0);
    const currentTotal = Number(current.price?.amount || current.price || 0) + Number(current.shipping?.cost || current.shippingCost || 0);
    return currentTotal < bestTotal ? current : best;
  });

  const bestTotalPrice = Number(bestDeal.price?.amount || bestDeal.price || 0) + Number(bestDeal.shipping?.cost || bestDeal.shippingCost || 0);
  const bestCurrency = String(bestDeal.price?.currency || 'PLN');

  await productRef.update({
    bestPrice: { amount: bestTotalPrice, currency: bestCurrency },
    bestTotalPrice,
    bestDealId: bestDeal.id,
    linkedDealIds: approvedDeals.map((deal) => deal.id),
    updatedAt: now,
  });

  console.log(JSON.stringify({
    productId,
    promotedDeals: toApprove.length,
    approvedDeals: approvedDeals.length,
    bestDealId: bestDeal.id,
    bestTotalPrice,
    bestCurrency,
  }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
