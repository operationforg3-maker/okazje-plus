import { adminDb } from '../src/lib/firebase-admin';
import { recalculateBestPrices } from '../src/lib/automation/best-price';

async function fixExistingApprovedDeals() {
  console.log('Fetching all approved products...');
  const productsSnap = await adminDb.collection('product_cores')
    .where('status', '==', 'approved')
    .get();

  console.log(`Found ${productsSnap.docs.length} approved products.`);
  if (productsSnap.empty) return;

  const productIds = productsSnap.docs.map(doc => doc.id);
  const now = new Date().toISOString();

  let totalDealsApproved = 0;
  
  // Process in chunks of 10 products to avoid Firestore batch limits
  const CHUNK_SIZE = 10;
  for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
    const chunk = productIds.slice(i, i + CHUNK_SIZE);
    
    // Fetch deals for these products that are in 'poczekalnia' or 'pending' status
    const dealsSnap = await adminDb.collection('deals')
      .where('productId', 'in', chunk)
      .get();

    if (!dealsSnap.empty) {
      const batch = adminDb.batch();
      let countInBatch = 0;

      for (const doc of dealsSnap.docs) {
        const deal = doc.data();
        if (['poczekalnia', 'pending', 'draft'].includes(deal.status)) {
          batch.update(doc.ref, {
            status: 'approved',
            approvedAt: now,
            promotedAt: now,
            updatedAt: now
          });
          countInBatch++;
          totalDealsApproved++;
        }
      }

      if (countInBatch > 0) {
        await batch.commit();
        console.log(`Approved ${countInBatch} deals in this batch.`);
      }
    }
  }

  console.log(`Total deals approved: ${totalDealsApproved}`);
  console.log('Recalculating best prices for all approved products...');
  await recalculateBestPrices(productIds);
  console.log('Best prices recalculated successfully!');
}

fixExistingApprovedDeals();
