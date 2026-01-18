const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function fixDealsStructure() {
  console.log('🔧 PHASE 1: Fixing Deal price structure...\n');

  try {
    const dealsSnap = await db.collection('deals').get();
    console.log(`🔗 Total deals: ${dealsSnap.size}`);

    let fixed = 0;
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const dealDoc of dealsSnap.docs) {
      const deal = dealDoc.data();
      
      // Check if price needs fixing
      if (typeof deal.price !== 'object' || !deal.price?.amount) {
        // Price is legacy format (number)
        const priceAmount = typeof deal.price === 'number' ? deal.price : (deal.priceV2?.amount || 0);
        const priceCurrency = deal.priceV2?.currency || 'PLN';
        
        batch.update(dealDoc.ref, {
          price: {
            amount: priceAmount,
            currency: priceCurrency,
          },
          legacyPrice: typeof deal.price === 'number' ? deal.price : undefined,
        });
        
        fixed++;
        batchCount++;
        
        if (batchCount === BATCH_SIZE) {
          await batch.commit();
          console.log(`  ✓ Committed ${batchCount} deals`);
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      console.log(`  ✓ Committed final ${batchCount} deals`);
    }

    console.log(`✨ PHASE 1 Complete: Fixed ${fixed} deals\n`);
  } catch (e) {
    console.error('Phase 1 error:', e.message);
    process.exit(1);
  }
}

async function rebuildBestPrices() {
  console.log('🔄 PHASE 2: Rebuilding bestPrice for all products...\n');

  try {
    // Get all product_cores
    const productsSnap = await db.collection('product_cores').get();
    console.log(`📦 Total products: ${productsSnap.size}`);

    let updated = 0;
    let failed = 0;

    for (const productDoc of productsSnap.docs) {
      const productId = productDoc.id;
      const product = productDoc.data();

      try {
        // Get all deals for this product
        const dealsSnap = await db
          .collection('deals')
          .where('productCoreId', '==', productId)
          .get();

        if (dealsSnap.empty) {
          console.log(`⊘ ${productId}: No deals found`);
          continue;
        }

        // Find best price
        let bestPrice = Infinity;
        let bestCurrency = 'PLN';
        let bestDealId = null;
        let validDealsCount = 0;

        for (const dealDoc of dealsSnap.docs) {
          const deal = dealDoc.data();
          const priceAmount = deal.price?.amount || (typeof deal.price === 'number' ? deal.price : 0);
          const shippingCost = deal.shipping?.cost || 0;
          const totalPrice = priceAmount + shippingCost;

          // Skip deals with 0 price
          if (totalPrice <= 0) continue;

          validDealsCount++;

          if (totalPrice < bestPrice) {
            bestPrice = totalPrice;
            bestCurrency = deal.price?.currency || 'PLN';
            bestDealId = dealDoc.id;
          }
        }

        if (bestPrice === Infinity) {
          console.log(`⊘ ${productId}: No valid deals (${dealsSnap.size} deals total, 0 valid)`);
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
        console.log(`✅ ${productId}: bestPrice=${bestPrice} PLN (from ${validDealsCount} deals)`);
      } catch (e) {
        failed++;
        console.error(`❌ ${productId}: Error - ${e.message}`);
      }
    }

    console.log(`\n✨ PHASE 2 Complete: Updated: ${updated}, Failed: ${failed}, Total: ${productsSnap.size}`);
    process.exit(0);
  } catch (e) {
    console.error('Phase 2 error:', e.message);
    process.exit(1);
  }
}

(async () => {
  await fixDealsStructure();
  await rebuildBestPrices();
})();
