const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function quickRebuildBestPrices() {
  console.log('⚡ Quick rebuild using existing priceV2 data...\n');

  try {
    // Get all product_cores
    const productsSnap = await db.collection('product_cores').get();
    console.log(`📦 Total products: ${productsSnap.size}`);

    let updated = 0;
    let skipped = 0;

    for (const productDoc of productsSnap.docs) {
      const productId = productDoc.id;

      try {
        // Get all deals for this product
        const dealsSnap = await db
          .collection('deals')
          .where('productCoreId', '==', productId)
          .get();

        if (dealsSnap.empty) {
          continue;
        }

        // Find best price using priceV2 (which has correct structure)
        let bestPrice = Infinity;
        let bestCurrency = 'PLN';
        let bestDealId = null;
        let validDealsCount = 0;

        for (const dealDoc of dealsSnap.docs) {
          const deal = dealDoc.data();
          // Try priceV2 first (already has {amount, currency}), fallback to price field
          const priceAmount = deal.priceV2?.amount || (deal.price?.amount) || (typeof deal.price === 'number' ? deal.price : 0);
          const shippingCost = deal.shipping?.cost || 0;
          const totalPrice = priceAmount + shippingCost;

          // Skip deals with 0 price
          if (totalPrice <= 0) continue;

          validDealsCount++;

          if (totalPrice < bestPrice) {
            bestPrice = totalPrice;
            bestCurrency = deal.priceV2?.currency || deal.price?.currency || 'PLN';
            bestDealId = dealDoc.id;
          }
        }

        if (bestPrice === Infinity) {
          skipped++;
          continue;
        }

        // Update product
        await db.collection('product_cores').doc(productId).update({
          bestPrice: {
            amount: bestPrice,
            currency: bestCurrency,
          },
          bestDealId: bestDealId,
          linkedDealIds: dealsSnap.docs.map(d => d.id),
          updatedAt: new Date().toISOString(),
        });

        updated++;
        if (updated % 100 === 0) {
          console.log(`✅ Updated ${updated} products...`);
        }
      } catch (e) {
        console.error(`❌ ${productId}: ${e.message}`);
      }
    }

    console.log(`\n✨ Done! Updated: ${updated}, Skipped: ${skipped}`);
    process.exit(0);
  } catch (e) {
    console.error('Fatal error:', e.message);
    process.exit(1);
  }
}

quickRebuildBestPrices();
