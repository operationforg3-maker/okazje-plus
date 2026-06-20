import { adminDb } from '../src/lib/firebase-admin';

async function debugData() {
  console.log('--- HARVESTER JOBS HISTORY ---');
  const jobsSnap = await adminDb.collection('harvester_jobs')
    .orderBy('startedAt', 'desc')
    .limit(10)
    .get();
  
  for (const doc of jobsSnap.docs) {
    const data = doc.data();
    console.log(`Job ID: ${doc.id}`);
    console.log(`- Status: ${data.status}`);
    console.log(`- Started At: ${data.startedAt}`);
    console.log(`- Target: ${data.target}`);
    console.log(`- Stats: Products Processed: ${data.productsProcessed}, Successful: ${data.productsSuccessful}, Failed: ${data.productsFailed}`);
    console.log(`- Refined Stats: ${data.refinedCount || 0}`);
    console.log(`- Options: ${JSON.stringify(data.options)}`);
    console.log(`- Error: ${data.error || 'none'}`);
  }

  console.log('\n--- TOTAL DATABASE COUNTS ---');
  const productsCount = (await adminDb.collection('product_cores').count().get()).data().count;
  const dealsCount = (await adminDb.collection('deals').count().get()).data().count;
  console.log(`Total ProductCores in DB: ${productsCount}`);
  console.log(`Total Deals in DB: ${dealsCount}`);

  console.log('\n--- SAMPLE DEALS FOR TEST PRODUCTS ---');
  const productIds = ['0zIDX01kHAw2mNULeQxo', '1IvrZ1zERDalJuCSu4VB'];
  for (const pid of productIds) {
    const dealsSnap = await adminDb.collection('deals')
      .where('productId', '==', pid)
      .get();
    console.log(`Product ${pid}: found ${dealsSnap.docs.length} deals.`);
    for (const d of dealsSnap.docs) {
      const ddata = d.data();
      console.log(`  - Deal ID: ${d.id}, Status: ${ddata.status}, Price: ${ddata.price?.current} ${ddata.price?.currency}, Affiliate URL: ${ddata.affiliateUrl ? 'yes' : 'no'}`);
    }
  }
}

debugData();
