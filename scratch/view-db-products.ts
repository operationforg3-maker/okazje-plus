import { adminDb } from '../src/lib/firebase-admin';

async function viewDbProducts() {
  const productIds = ['0zIDX01kHAw2mNULeQxo', '1IvrZ1zERDalJuCSu4VB'];
  for (const id of productIds) {
    console.log(`\n--- PRODUCT ${id} ---`);
    const doc = await adminDb.collection('product_cores').doc(id).get();
    if (!doc.exists) {
      console.log('Not found in database');
      continue;
    }
    const data = doc.data() as any;
    console.log('Title:', JSON.stringify(data.title, null, 2));
    console.log('Specs:', JSON.stringify(data.specs, null, 2));
    console.log('Description PL:', data.description?.pl?.substring(0, 150) + '...');
    console.log('Description EN:', data.description?.en?.substring(0, 150) + '...');
    console.log('SEO description:', data.seoDescription);
  }
}

viewDbProducts();
