import { AIRefiner } from '../src/lib/automation/refiner';
import { adminDb } from '../src/lib/firebase-admin';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function enrichLiveProducts() {
  const productIds = ['0zIDX01kHAw2mNULeQxo', '1IvrZ1zERDalJuCSu4VB'];
  console.log(`Starting real sequential enrichment for products: ${productIds.join(', ')}`);
  
  for (let i = 0; i < productIds.length; i++) {
    const id = productIds[i];
    console.log(`\n[${i + 1}/${productIds.length}] Enriching product ${id}...`);
    const refiner = new AIRefiner(`live-enrich-${id}-${Date.now()}`);
    
    try {
      const jobResult = await refiner.refineProducts([id], 'full_enrichment', false);
      console.log(`Product ${id} enriched! Result:`, JSON.stringify(jobResult.status));
      console.log('Logs for product:', JSON.stringify(jobResult.logs, null, 2));
    } catch (err) {
      console.error(`Enrichment failed for product ${id}:`, err);
    }
    
    if (i < productIds.length - 1) {
      console.log('Sleeping 65 seconds to fully reset Gemini RPM rate limits...');
      await sleep(65000);
    }
  }
  
  console.log('\nAll done!');
}

enrichLiveProducts();
