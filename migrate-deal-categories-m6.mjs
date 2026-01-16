import admin from 'firebase-admin';
import fs from 'fs';

const serviceKey = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceKey) });
const db = admin.firestore();

/**
 * M6 Migration: Assign categories from ProductCore to all Deals
 * 
 * Problem: Old deals might not have mainCategorySlug, subCategorySlug, subSubCategorySlug
 * Solution: Copy from ProductCore to Deal
 */
async function migrateDealCategories() {
  console.log('🚀 Starting M6 Deal Category Migration...\n');
  
  // Find all deals without proper categories
  const deals = await db.collection('deals')
    .where('status', '==', 'approved')
    .limit(1000)
    .get();
  
  console.log(`📊 Found ${deals.size} deals to check\n`);
  
  let fixed = 0;
  let missing = 0;
  let batch = db.batch();
  let batchCount = 0;
  
  for (const dealDoc of deals.docs) {
    const deal = dealDoc.data();
    const needsFix = !deal.mainCategorySlug || deal.mainCategorySlug === 'uncategorized';
    
    if (needsFix) {
      // Get ProductCore to copy categories
      const productSnap = await db.collection('product_cores').doc(deal.productCoreId).get();
      
      if (productSnap.exists) {
        const product = productSnap.data();
        if (product.mainCategorySlug) {
          batch.update(dealDoc.ref, {
            mainCategorySlug: product.mainCategorySlug,
            subCategorySlug: product.subCategorySlug || 'uncategorized',
            subSubCategorySlug: product.subSubCategorySlug || undefined,
            category: `${product.mainCategorySlug}${product.subCategorySlug ? '/' + product.subCategorySlug : ''}${product.subSubCategorySlug ? '/' + product.subSubCategorySlug : ''}`,
            updatedAt: new Date().toISOString(),
          });
          fixed++;
          batchCount++;
          
          console.log(`✅ Fixed deal ${dealDoc.id}`);
          console.log(`   → ${product.mainCategorySlug}/${product.subCategorySlug}/${product.subSubCategorySlug || 'none'}`);
          
          if (batchCount >= 100) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
            console.log(`\n💾 Batch committed. Total fixed: ${fixed}\n`);
          }
        } else {
          missing++;
          console.log(`⚠️  Deal ${dealDoc.id} - Product has no category`);
        }
      } else {
        missing++;
        console.log(`❌ Deal ${dealDoc.id} - Product not found: ${deal.productCoreId}`);
      }
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`\n✨ Migration complete!`);
  console.log(`📈 Fixed: ${fixed} deals`);
  console.log(`⚠️  Missing/Error: ${missing} deals`);
  
  process.exit(0);
}

migrateDealCategories().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
