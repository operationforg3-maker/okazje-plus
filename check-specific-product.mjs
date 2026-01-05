#!/usr/bin/env node
import admin from 'firebase-admin';
import fs from 'fs';

const key = JSON.parse(fs.readFileSync('./serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(key),
  projectId: 'okazjeplus-prod'
});

const db = admin.firestore();

const productId = 'zVMBPWFJrrrPsxHTCYF6';

async function checkProduct() {
  console.log(`Checking product ID: ${productId}\n`);

  // Check product_cores collection
  const coreRef = db.collection('product_cores').doc(productId);
  const coreSnap = await coreRef.get();
  if (coreSnap.exists) {
    const data = coreSnap.data();
    console.log('✓ Found in product_cores:');
    console.log(`  - Status: ${data.status}`);
    console.log(`  - Title: ${typeof data.title === 'object' ? data.title.pl || data.title.en : data.title}`);
    console.log(`  - Has images: ${Array.isArray(data.images) ? `${data.images.length} images` : 'NO'}`);
    console.log(`  - Has bestPrice: ${data.bestPrice ? 'YES' : 'NO'}`);
    console.log(`  - Deals count: ${data.dealCount || 'unknown'}`);
  } else {
    console.log('✗ NOT found in product_cores');
  }

  // Check products collection (legacy)
  const legacyRef = db.collection('products').doc(productId);
  const legacySnap = await legacyRef.get();
  if (legacySnap.exists) {
    const data = legacySnap.data();
    console.log('✓ Found in products (legacy):');
    console.log(`  - Status: ${data.status}`);
    console.log(`  - Name: ${data.name}`);
    console.log(`  - Has image: ${data.image ? 'YES' : 'NO'}`);
  } else {
    console.log('✗ NOT found in products (legacy)');
  }

  // Check deals linked to this product
  const dealsRef = db.collection('deals').where('productCoreId', '==', productId);
  const dealsSnap = await dealsRef.get();
  console.log(`\nLinked deals: ${dealsSnap.size}`);
  if (dealsSnap.size > 0) {
    dealsSnap.docs.slice(0, 3).forEach((deal, i) => {
      const d = deal.data();
      console.log(`  ${i + 1}. ${d.source} - ${d.merchantName} (${d.price?.amount || 'no price'})`);
    });
  }
}

checkProduct().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
