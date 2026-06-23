const admin = require('firebase-admin');
const fs = require('fs');

const key = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

(async () => {
  console.log('Starting migration to add idLowercase field...');

  // 1. Update product_cores
  const productCoresSnap = await db.collection('product_cores').get();
  console.log(`Found ${productCoresSnap.size} documents in product_cores collection.`);
  
  let coreCount = 0;
  let coreBatch = db.batch();
  for (const doc of productCoresSnap.docs) {
    coreBatch.update(doc.ref, { idLowercase: doc.id.toLowerCase() });
    coreCount++;
    if (coreCount % 400 === 0) {
      await coreBatch.commit();
      console.log(`Committed batch of 400 product_cores (Total: ${coreCount})`);
      coreBatch = db.batch(); // Create a new batch after commit
    }
  }
  if (coreCount % 400 !== 0) {
    await coreBatch.commit();
    console.log(`Committed final batch of product_cores (Total: ${coreCount})`);
  }

  // 2. Update legacy products
  const productsSnap = await db.collection('products').get();
  console.log(`Found ${productsSnap.size} documents in legacy products collection.`);
  
  let productCount = 0;
  let productBatch = db.batch();
  for (const doc of productsSnap.docs) {
    productBatch.update(doc.ref, { idLowercase: doc.id.toLowerCase() });
    productCount++;
    if (productCount % 400 === 0) {
      await productBatch.commit();
      console.log(`Committed batch of 400 legacy products (Total: ${productCount})`);
      productBatch = db.batch(); // Create a new batch after commit
    }
  }
  if (productCount % 400 !== 0) {
    await productBatch.commit();
    console.log(`Committed final batch of legacy products (Total: ${productCount})`);
  }

  console.log('Migration completed successfully!');
})();
