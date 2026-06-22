import { adminDb } from '../src/lib/firebase-admin';
import { AIRefiner } from '../src/lib/automation/refiner';
import { getAliExpressProductDetailsDirect } from '../src/integrations/aliexpress/details';
import { queueProductsForIndexing } from '../src/search/typesenseQueue';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfill() {
  console.log('Fetching AliExpress products from Firestore...');
  
  try {
    const querySnapshot = await adminDb.collection('product_cores')
      .where('metadata.source', '==', 'aliexpress')
      .get();
      
    console.log(`Found ${querySnapshot.size} total AliExpress products.`);
    
    const toEnrich: string[] = [];
    const toCleanupSpecs: string[] = [];
    
    // Process products and scrape if needed
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const originalId = data.metadata?.originalId;
      
      if (!originalId) {
        console.warn(`Product ${doc.id} is missing metadata.originalId. Skipping.`);
        continue;
      }
      
      const hasSpecs = data.specs && Object.keys(data.specs).length > 0;
      const hasRawSpecs = data.rawSpecs && Object.keys(data.rawSpecs).length > 0;
      const hasMetaSpecs = data.metadata?.specifications && Object.keys(data.metadata.specifications).length > 0;
      const hasAttributes = data.attributes && data.attributes.length > 0;
      const hasDescription = data.fullDescription && 
        typeof data.fullDescription === 'object' && 
        Object.keys(data.fullDescription).length > 0 &&
        Object.values(data.fullDescription).some(v => typeof v === 'string' && v.trim().length > 0);
        
      const isMissingSpecs = !hasSpecs && !hasRawSpecs && !hasMetaSpecs && !hasAttributes;
      const isMissingDescription = !hasDescription;
      
      // If we are missing specs or descriptions, trigger inline direct scrape
      if (isMissingSpecs || isMissingDescription) {
        console.log(`- Product ${doc.id} (${data.title?.pl || 'Unnamed'}) is missing specs/description. Scraping direct details for AliExpress ID ${originalId}...`);
        
        try {
          // Direct scraping call
          const details = await getAliExpressProductDetailsDirect(originalId);
          const scrapedProduct = details.product;
          
          if (scrapedProduct) {
            const updateData: any = {};
            
            // Merge specs, keeping existing Firestore values to respect manual edits
            const mergedSpecs = { ...scrapedProduct.specs, ...data.specs };
            const mergedRawSpecs = { ...scrapedProduct.specs, ...data.rawSpecs };
            
            const mergedAttributes = [ ...(data.attributes || []) ];
            (scrapedProduct.attributes || []).forEach((attr: any) => {
              if (!mergedAttributes.some((existingAttr: any) => existingAttr.name === attr.name)) {
                mergedAttributes.push(attr);
              }
            });
            
            if (!hasSpecs) {
              updateData.specs = mergedSpecs;
            }
            if (!hasRawSpecs) {
              updateData.rawSpecs = mergedRawSpecs;
            }
            if (!hasAttributes) {
              updateData.attributes = mergedAttributes;
            }
            
            // Set descriptionHtml if missing to allow refiner to build localized description
            if (!data.descriptionHtml && scrapedProduct.descriptionHtml) {
              updateData.descriptionHtml = scrapedProduct.descriptionHtml;
            }
            
            // Add other helpful scraped fields if missing
            if (!data.rating || !data.rating.score) {
              updateData.rating = {
                score: scrapedProduct.rating || 0,
                count: scrapedProduct.orders || 0,
                provider: 'aliexpress',
              };
            }
            
            if (!data.seller) {
              updateData.seller = scrapedProduct.merchant ? {
                name: scrapedProduct.merchant,
                storeUrl: scrapedProduct.storeUrl || '',
                rating: scrapedProduct.rating || 4.5,
              } : undefined;
            }
            
            // Save to Firestore
            if (Object.keys(updateData).length > 0) {
              await adminDb.collection('product_cores').doc(doc.id).set(updateData, { merge: true });
              console.log(`  Successfully merged scraped data into product ${doc.id}`);
            }
          }
          
          // Throttling to prevent API rate limit issues
          await delay(1500);
        } catch (scrapeErr) {
          console.error(`  Error scraping direct details for product ${doc.id}:`, scrapeErr);
        }
      }
      
      // Determine target queue after merge
      // Re-read or determine based on merged status:
      // If the product still lacks description: toEnrich
      // If the product has description but lacks specs/specsLocalized: toCleanupSpecs
      const updatedDoc = await adminDb.collection('product_cores').doc(doc.id).get();
      const updatedData = updatedDoc.data() || {};
      
      const hasDescriptionNow = updatedData.fullDescription && 
        typeof updatedData.fullDescription === 'object' && 
        Object.keys(updatedData.fullDescription).length > 0 &&
        Object.values(updatedData.fullDescription).some((v: any) => typeof v === 'string' && v.trim().length > 0);
        
      const hasSpecsNow = updatedData.specs && Object.keys(updatedData.specs).length > 0;
      
      if (!hasDescriptionNow) {
        toEnrich.push(doc.id);
        console.log(`- Queued for 'full_enrichment': ${doc.id} (${updatedData.title?.pl || 'Unnamed'})`);
      } else if (!hasSpecsNow || !updatedData.specsLocalized) {
        toCleanupSpecs.push(doc.id);
        console.log(`- Queued for 'specs_cleanup': ${doc.id} (${updatedData.title?.pl || 'Unnamed'})`);
      }
    }
    
    console.log(`\nQueue summary:`);
    console.log(`- toEnrich (full_enrichment): ${toEnrich.length}`);
    console.log(`- toCleanupSpecs (specs_cleanup): ${toCleanupSpecs.length}`);
    
    // 1. Process full_enrichment queue
    if (toEnrich.length > 0) {
      console.log(`\nStarting 'full_enrichment' refinement for ${toEnrich.length} products...`);
      const refinerEnrich = new AIRefiner('backfill-enrich-' + Date.now());
      const resultEnrich = await refinerEnrich.refineProducts(toEnrich, 'full_enrichment', false);
      console.log(`'full_enrichment' job finished:`, resultEnrich);
    }
    
    // 2. Process specs_cleanup queue
    if (toCleanupSpecs.length > 0) {
      console.log(`\nStarting 'specs_cleanup' refinement for ${toCleanupSpecs.length} products...`);
      const refinerCleanup = new AIRefiner('backfill-cleanup-' + Date.now());
      const resultCleanup = await refinerCleanup.refineProducts(toCleanupSpecs, 'specs_cleanup', false);
      console.log(`'specs_cleanup' job finished:`, resultCleanup);
    }
    
    // 3. Typesense Indexing
    const allProcessed = [...toEnrich, ...toCleanupSpecs];
    if (allProcessed.length > 0) {
      console.log(`\nQueueing ${allProcessed.length} products for search indexing...`);
      try {
        await queueProductsForIndexing(allProcessed);
        console.log('✅ Successfully queued products for indexing.');
      } catch (indexErr) {
        console.error('❌ Failed to queue products for indexing:', indexErr);
      }
    }
    
    console.log('\nBackfill completed successfully!');
    
  } catch (err) {
    console.error('Error during backfill script execution:', err);
  }
}

backfill().catch(console.error);
