import { adminDb } from '@/lib/firebase-admin';
import { DealM6 } from '@/lib/types';

/**
 * Recalculate and update the bestPrice, bestTotalPrice, bestDealId, and linkedDealIds 
 * for a list of productIds based on their active and approved deals.
 */
export async function recalculateBestPrices(productIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const CHUNK_SIZE = 10;
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();

    const productSnapshots = await Promise.all(
      chunk.map(id => adminDb.collection('product_cores').doc(id).get())
    );

    const dealsSnapshots = await Promise.all(
      chunk.map(id =>
        adminDb.collection('deals')
          .where('productId', '==', id)
          .where('status', '==', 'approved')
          .where('isActive', '==', true)
          .get()
      )
    );

    chunk.forEach((productId, idx) => {
      const productSnap = productSnapshots[idx];
      const productData = productSnap.exists ? productSnap.data() : null;
      const productStatus = productData?.status || 'pending_approval';

      if (productStatus !== 'approved') {
        console.log(`[recalculateBestPrices] Skipping pending/draft product: ${productId} (status: ${productStatus})`);
        return;
      }

      const dealsSnap = dealsSnapshots[idx];
      const productRef = adminDb.collection('product_cores').doc(productId);

      if (dealsSnap.empty) {
        console.warn(`[recalculateBestPrices] No approved and active deals found for product: ${productId}`);
        batch.update(productRef, {
          bestPrice: {
            amount: 0,
            currency: 'PLN',
          },
          bestTotalPrice: null,
          bestDealId: null,
          linkedDealIds: [],
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      const deals = dealsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as DealM6),
      }));

      // Find the deal with the lowest total price (price + shipping)
      const bestDeal = deals.reduce((best, current) => {
        const bestPrice = Number(best.price?.amount || 0) + Number(best.shipping?.cost || 0);
        const currentPrice = Number(current.price?.amount || 0) + Number(current.shipping?.cost || 0);
        return currentPrice < bestPrice ? current : best;
      });

      const bestTotalPrice = Number(bestDeal.price?.amount || 0) + Number(bestDeal.shipping?.cost || 0);
      const bestCurrency = (bestDeal.price?.currency as any) || 'PLN';

      batch.update(productRef, {
        bestPrice: {
          amount: bestTotalPrice,
          currency: bestCurrency,
        },
        bestTotalPrice: bestTotalPrice,
        bestDealId: bestDeal.id,
        linkedDealIds: deals.map((deal) => deal.id),
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();
  }
}
