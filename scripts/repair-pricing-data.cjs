#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(process.cwd(), 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const { FieldPath } = admin.firestore;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const APPROVED_ONLY = !args.includes('--all-statuses');
const BATCH_SIZE = 400;

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getDealPriceAmount(deal) {
  const nested = toNumber(deal?.price?.amount);
  if (nested !== null) return nested;
  const direct = toNumber(deal?.price);
  if (direct !== null) return direct;
  return null;
}

function getDealShippingCost(deal) {
  const nested = toNumber(deal?.price?.shippingCost);
  if (nested !== null) return nested;
  const direct = toNumber(deal?.shippingCost);
  if (direct !== null) return direct;
  const shipping = toNumber(deal?.shipping?.cost);
  if (shipping !== null) return shipping;
  return 0;
}

function getDealTotalPrice(deal) {
  const nested = toNumber(deal?.price?.totalPrice);
  if (nested !== null) return nested;
  const direct = toNumber(deal?.totalPrice);
  if (direct !== null) return direct;
  const amount = getDealPriceAmount(deal);
  if (amount === null) return null;
  return amount + getDealShippingCost(deal);
}

function getDealCurrency(deal) {
  return (
    (typeof deal?.price?.currency === 'string' && deal.price.currency) ||
    (typeof deal?.currency === 'string' && deal.currency) ||
    'PLN'
  );
}

function isSuspiciousPrice(n) {
  return !(typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 200000);
}

async function fetchCollectionPaged(collectionName, { approvedOnly = true } = {}) {
  const out = [];
  let lastId = null;

  for (;;) {
    let q = db.collection(collectionName);
    if (approvedOnly) q = q.where('status', '==', 'approved');
    q = q.orderBy(FieldPath.documentId()).limit(BATCH_SIZE);
    if (lastId) q = q.startAfter(lastId);

    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) out.push({ id: doc.id, ...doc.data() });

    lastId = snap.docs[snap.docs.length - 1].id;
    if (snap.size < BATCH_SIZE) break;
  }

  return out;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Scope: ${APPROVED_ONLY ? 'approved only' : 'all statuses'}`);

  const deals = await fetchCollectionPaged('deals', { approvedOnly: APPROVED_ONLY });
  const products = await fetchCollectionPaged('product_cores', { approvedOnly: APPROVED_ONLY });

  const report = {
    dealsScanned: deals.length,
    productsScanned: products.length,
    suspiciousDeals: 0,
    dealTotalPriceFixes: 0,
    dealShippingFixes: 0,
    productBestPriceFixes: 0,
    productBestDealFixes: 0,
    productLinkedDealsFixes: 0,
    productsWithoutDeals: 0,
  };

  const dealsByProduct = new Map();

  for (const deal of deals) {
    const productCoreId = typeof deal.productCoreId === 'string' ? deal.productCoreId : null;
    const priceAmount = getDealPriceAmount(deal);
    const shippingCost = getDealShippingCost(deal);
    const totalPrice = getDealTotalPrice(deal);

    if (priceAmount === null || isSuspiciousPrice(priceAmount) || isSuspiciousPrice(totalPrice)) {
      report.suspiciousDeals += 1;
    }

    const updates = {};
    if (priceAmount !== null) {
      const currentTotal = toNumber(deal?.price?.totalPrice) ?? toNumber(deal?.totalPrice);
      const computedTotal = priceAmount + shippingCost;
      if (currentTotal === null || Math.abs(currentTotal - computedTotal) > 0.001 || currentTotal <= 0) {
        updates.totalPrice = computedTotal;
        updates.price = {
          ...(typeof deal.price === 'object' && deal.price ? deal.price : {}),
          amount: priceAmount,
          shippingCost,
          totalPrice: computedTotal,
          currency: getDealCurrency(deal),
        };
        report.dealTotalPriceFixes += 1;
      }

      const currentShipping = toNumber(deal?.shippingCost);
      if (currentShipping === null || Math.abs(currentShipping - shippingCost) > 0.001) {
        updates.shippingCost = shippingCost;
        report.dealShippingFixes += 1;
      }
    }

    if (APPLY && Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      await db.collection('deals').doc(deal.id).set(updates, { merge: true });
    }

    if (productCoreId && totalPrice !== null && !isSuspiciousPrice(totalPrice)) {
      const list = dealsByProduct.get(productCoreId) || [];
      list.push({
        id: deal.id,
        totalPrice,
        priceAmount: priceAmount ?? totalPrice,
        currency: getDealCurrency(deal),
      });
      dealsByProduct.set(productCoreId, list);
    }
  }

  for (const product of products) {
    const productDeals = dealsByProduct.get(product.id) || [];
    if (productDeals.length === 0) {
      report.productsWithoutDeals += 1;
      continue;
    }

    productDeals.sort((a, b) => a.totalPrice - b.totalPrice);
    const best = productDeals[0];
    const linkedDealIds = productDeals.map((d) => d.id);

    const currentBestDealId = typeof product.bestDealId === 'string' ? product.bestDealId : null;
    const currentBestAmount = toNumber(product?.bestPrice?.amount);
    const currentBestCurrency =
      (typeof product?.bestPrice?.currency === 'string' && product.bestPrice.currency) || null;
    const currentBestTotal = toNumber(product?.bestTotalPrice);
    const currentLinked = Array.isArray(product.linkedDealIds) ? product.linkedDealIds : [];

    const updates = {};

    if (currentBestDealId !== best.id) {
      updates.bestDealId = best.id;
      report.productBestDealFixes += 1;
    }

    if (
      currentBestAmount === null ||
      Math.abs(currentBestAmount - best.priceAmount) > 0.001 ||
      currentBestCurrency !== best.currency
    ) {
      updates.bestPrice = { amount: best.priceAmount, currency: best.currency };
      report.productBestPriceFixes += 1;
    }

    if (currentBestTotal === null || Math.abs(currentBestTotal - best.totalPrice) > 0.001) {
      updates.bestTotalPrice = best.totalPrice;
      report.productBestPriceFixes += 1;
    }

    const sameLinks =
      currentLinked.length === linkedDealIds.length &&
      currentLinked.every((id, i) => id === linkedDealIds[i]);

    if (!sameLinks) {
      updates.linkedDealIds = linkedDealIds;
      report.productLinkedDealsFixes += 1;
    }

    if (APPLY && Object.keys(updates).length > 0) {
      updates.updatedAt = new Date().toISOString();
      await db.collection('product_cores').doc(product.id).set(updates, { merge: true });
    }
  }

  console.log('\n=== PRICING AUDIT REPORT ===');
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log('\nDry-run complete. Run with --apply to persist changes.');
  } else {
    console.log('\nApply complete.');
  }
}

main().catch((error) => {
  console.error('Pricing repair failed:', error);
  process.exit(1);
});
