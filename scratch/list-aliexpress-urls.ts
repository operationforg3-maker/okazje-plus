import { adminDb } from '../src/lib/firebase-admin';

async function listUrls() {
  const dealsSnap = await adminDb.collection('deals')
    .where('source', '==', 'aliexpress')
    .limit(10)
    .get();
  
  console.log(`Found ${dealsSnap.docs.length} AliExpress deals:`);
  for (const doc of dealsSnap.docs) {
    const d = doc.data();
    console.log(`- Deal ID: ${doc.id}`);
    console.log(`  Source Product ID: ${d.sourceProductId}`);
    console.log(`  Price: ${d.price?.amount} ${d.price?.currency}`);
    console.log(`  Original Price: ${d.originalPrice}`);
    console.log(`  Title (pl): ${d.title?.pl}`);
    console.log(`  URL: ${d.sourceUrl}`);
  }
}

listUrls();
