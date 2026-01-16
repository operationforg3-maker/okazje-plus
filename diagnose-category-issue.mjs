import admin from 'firebase-admin';
import fs from 'fs';

const serviceKey = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceKey) });
const db = admin.firestore();

async function migrate() {
  console.log('📋 Checking deals without categories...\n');
  
  const snapshot = await db.collection('deals')
    .where('mainCategorySlug', '==', 'uncategorized')
    .limit(20)
    .get();
  
  console.log(`Found ${snapshot.size} deals with uncategorized status\n`);
  
  if (snapshot.size === 0) {
    console.log('✅ All deals have categories assigned!');
    process.exit(0);
  }
  
  // Group by productCoreId to get categories
  const dealsToFix = [];
  for (const doc of snapshot.docs) {
    const deal = doc.data();
    dealsToFix.push({
      id: doc.id,
      productCoreId: deal.productCoreId,
      title: deal.title?.substring(0, 50),
    });
  }
  
  console.log('Deals to fix:');
  dealsToFix.forEach((d, i) => {
    console.log(`${i + 1}. ${d.title} (productCoreId: ${d.productCoreId})`);
  });
  
  // Check products to see if they have categories
  console.log('\n📦 Checking product categories...\n');
  for (const deal of dealsToFix) {
    const productSnap = await db.collection('product_cores').doc(deal.productCoreId).get();
    if (productSnap.exists) {
      const product = productSnap.data();
      console.log(`Product ${deal.productCoreId}:`);
      console.log(`  - mainCategorySlug: ${product.mainCategorySlug || 'MISSING'}`);
      console.log(`  - subCategorySlug: ${product.subCategorySlug || 'MISSING'}`);
      console.log(`  - subSubCategorySlug: ${product.subSubCategorySlug || 'MISSING'}`);
    } else {
      console.log(`❌ Product ${deal.productCoreId} NOT FOUND`);
    }
  }
  
  process.exit(0);
}

migrate();
