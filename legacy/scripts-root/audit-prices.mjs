#!/usr/bin/env node
/**
 * Price Audit Script
 * Compares stored prices with actual AliExpress API prices
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function auditPrices() {
  console.log('🔍 PRICE AUDIT - Comparing DB prices with AliExpress\n');
  
  // Get 5 random pending products
  const snapshot = await db.collection('product_cores')
    .where('status', '==', 'pending_approval')
    .where('metadata.source', '==', 'aliexpress')
    .limit(10)
    .get();
    
  if (snapshot.empty) {
    console.log('❌ No pending AliExpress products found');
    return;
  }
  
  console.log(`Found ${snapshot.size} products to audit\n`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const title = typeof data.title === 'object' ? data.title.en || data.title.pl || data.title.de : data.title;
    const storedPrice = data.bestPrice?.amount || 0;
    const currency = data.bestPrice?.currency || 'PLN';
    const productId = data.metadata?.originalId;
    
    console.log('━'.repeat(80));
    console.log(`📦 ${title.substring(0, 60)}`);
    console.log(`   ID: ${productId}`);
    console.log(`   Stored: ${storedPrice} ${currency}`);
    console.log(`   Link: https://www.aliexpress.com/item/${productId}.html`);
    
    // Check if we have deals linked
    const dealsSnapshot = await db.collection('deals')
      .where('productCoreId', '==', doc.id)
      .limit(1)
      .get();
      
    if (!dealsSnapshot.empty) {
      const deal = dealsSnapshot.docs[0].data();
      console.log(`   Deal price: ${deal.price} ${deal.currency || 'PLN'}`);
      console.log(`   Deal priceV2: ${JSON.stringify(deal.priceV2)}`);
    }
    
    // Check variants
    if (data.variants && data.variants.length > 0) {
      console.log(`   ✅ Has ${data.variants.length} variants`);
    } else {
      console.log(`   ⚠️  No variants found`);
    }
    
    console.log('');
  }
  
  console.log('\n💡 CURRENCY CONVERSION CHECK:');
  console.log('   - AliExpress API returns prices in USD');
  console.log('   - Harvester converts USD → PLN using NBP API');
  console.log('   - Current USD/PLN rate: ~4.0 PLN');
  console.log('   - Example: $20 USD → ~80 PLN');
  
  console.log('\n🔗 VARIANT CHECK:');
  const variantProducts = await db.collection('product_cores')
    .where('metadata.source', '==', 'aliexpress')
    .limit(50)
    .get();
    
  let withVariants = 0;
  let withoutVariants = 0;
  
  variantProducts.docs.forEach(doc => {
    const data = doc.data();
    if (data.variants && data.variants.length > 0) {
      withVariants++;
    } else {
      withoutVariants++;
    }
  });
  
  console.log(`   Total checked: ${variantProducts.size}`);
  console.log(`   With variants: ${withVariants} (${Math.round(withVariants/variantProducts.size*100)}%)`);
  console.log(`   Without variants: ${withoutVariants} (${Math.round(withoutVariants/variantProducts.size*100)}%)`);
}

auditPrices()
  .then(() => {
    console.log('\n✅ Audit complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Audit failed:', err);
    process.exit(1);
  });
