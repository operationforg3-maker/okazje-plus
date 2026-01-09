/**
 * Migration Script: Fix deals with USD prices stored as PLN
 * 
 * This script finds all deals that have USD currency but are actually PLN amounts (3-4x too low)
 * and converts them to proper PLN prices using a fallback rate of 4.0
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const FALLBACK_RATE = 4.0; // USD to PLN
const BATCH_SIZE = 500;

async function migrateDeals() {
  console.log('🔄 Starting deal price migration (USD→PLN)...\n');
  
  // Find all deals with priceV2.currency = 'USD'
  const dealsSnapshot = await db
    .collection('deals')
    .where('priceV2.currency', '==', 'USD')
    .get();
  
  console.log(`📊 Found ${dealsSnapshot.size} deals with USD currency\n`);
  
  if (dealsSnapshot.empty) {
    console.log('✅ No deals to migrate!');
    return;
  }
  
  const deals = dealsSnapshot.docs;
  let convertedCount = 0;
  let processedCount = 0;
  
  // Process in batches
  for (let i = 0; i < deals.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchDeals = deals.slice(i, i + BATCH_SIZE);
    
    for (const dealDoc of batchDeals) {
      const deal = dealDoc.data();
      const currentUSDAmount = deal.priceV2?.amount || 0;
      
      // Convert USD to PLN (actually these are wrongly labeled - they're already PLN amounts 3-4x too low)
      // To get actual PLN price: multiply by 4.0
      const correctedPLNAmount = Math.round(currentUSDAmount * FALLBACK_RATE * 100) / 100;
      
      console.log(
        `  Deal ${dealDoc.id}: ${currentUSDAmount} USD → ${correctedPLNAmount} PLN ` +
        `(${deal.price || 'N/A'} price, ${deal.source || 'unknown'} source)`
      );
      
      batch.update(dealDoc.ref, {
        'priceV2.currency': 'PLN',
        'priceV2.amount': correctedPLNAmount,
        // Also update legacy price field if exists
        ...(deal.price !== undefined && { price: correctedPLNAmount }),
        updatedAt: new Date().toISOString(),
        migrated: 'usd_to_pln_v1',
      });
      
      convertedCount++;
    }
    
    await batch.commit();
    processedCount += batchDeals.length;
    console.log(`\n✅ Processed batch: ${processedCount}/${deals.length}\n`);
  }
  
  // Also fix ProductCore bestPrice fields
  console.log('\n🔄 Now fixing ProductCore bestPrice fields...\n');
  
  const productsSnapshot = await db
    .collection('product_cores')
    .where('bestPrice.currency', '==', 'USD')
    .get();
  
  console.log(`📊 Found ${productsSnapshot.size} ProductCores with USD bestPrice\n`);
  
  if (!productsSnapshot.empty) {
    let productConvertedCount = 0;
    let productProcessedCount = 0;
    
    const products = productsSnapshot.docs;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const batchProducts = products.slice(i, i + BATCH_SIZE);
      
      for (const productDoc of batchProducts) {
        const product = productDoc.data();
        const currentUSDAmount = product.bestPrice?.amount || 0;
        const correctedPLNAmount = Math.round(currentUSDAmount * FALLBACK_RATE * 100) / 100;
        
        console.log(
          `  ProductCore ${productDoc.id}: ${currentUSDAmount} USD → ${correctedPLNAmount} PLN ` +
          `(${product.title?.pl || 'N/A'})`
        );
        
        batch.update(productDoc.ref, {
          'bestPrice.currency': 'PLN',
          'bestPrice.amount': correctedPLNAmount,
          updatedAt: new Date().toISOString(),
          migrated: 'usd_to_pln_v1',
        });
        
        productConvertedCount++;
      }
      
      await batch.commit();
      productProcessedCount += batchProducts.length;
      console.log(`\n✅ Processed ProductCore batch: ${productProcessedCount}/${products.length}\n`);
    }
    
    console.log(`\n📊 MIGRATION SUMMARY:`);
    console.log(`   Deals converted: ${convertedCount}`);
    console.log(`   ProductCores converted: ${productConvertedCount}`);
    console.log(`   Total currency fixes: ${convertedCount + productConvertedCount}`);
    console.log(`\n✅ Migration complete!\n`);
  } else {
    console.log(`\n📊 MIGRATION SUMMARY:`);
    console.log(`   Deals converted: ${convertedCount}`);
    console.log(`   ProductCores converted: 0`);
    console.log(`\n✅ Migration complete!\n`);
  }
}

migrateDeals()
  .catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    admin.app().delete();
  });
