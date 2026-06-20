import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { adminDb } from '../src/lib/firebase-admin';

async function runInspect() {
  const dealsSnap = await adminDb.collection('deals')
    .where('source', '==', 'aliexpress')
    .limit(3)
    .get();

  for (const dealDoc of dealsSnap.docs) {
    const deal = dealDoc.data();
    const productId = deal.productId || deal.productCoreId;
    
    console.log(`\n=== DEAL: ${dealDoc.id} ===`);
    console.log('Price info:', JSON.stringify(deal.price));
    console.log('Original Price:', deal.originalPrice);
    console.log('Shipping info:', JSON.stringify(deal.shipping));
    console.log('Seller info (Deal):', JSON.stringify(deal.seller));

    const productSnap = await adminDb.collection('product_cores').doc(productId).get();
    if (productSnap.exists) {
      const product = productSnap.data();
      console.log(`=== PRODUCT CORE: ${productId} ===`);
      console.log('Seller info (Product):', JSON.stringify(product?.seller));
      console.log('Logistics info (Product):', JSON.stringify(product?.logistics));
      console.log('Warehouses:', JSON.stringify(product?.warehouses));
      console.log('Marketing:', JSON.stringify(product?.marketing));
    } else {
      console.log(`Product Core ${productId} not found!`);
    }
  }
}

runInspect();
