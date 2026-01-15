import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDeal() {
  console.log('Checking deal data...\n');
  
  const dealsSnap = await db.collection('deals')
    .where('status', '==', 'approved')
    .limit(3)
    .get();
  
  if (dealsSnap.empty) {
    console.log('❌ No approved deals found');
    return;
  }
  
  console.log(`Found ${dealsSnap.size} approved deals\n`);
  
  dealsSnap.forEach((doc, idx) => {
    const deal = doc.data();
    console.log(`=== Deal ${idx + 1} (${doc.id}) ===`);
    console.log('Categories:');
    console.log('  mainCategorySlug:', deal.mainCategorySlug || '(missing)');
    console.log('  subCategorySlug:', deal.subCategorySlug || '(missing)');
    console.log('  subSubCategorySlug:', deal.subSubCategorySlug || '(missing)');
    console.log('\nTitle:');
    console.log('  Type:', typeof deal.title);
    if (typeof deal.title === 'object') {
      console.log('  PL:', deal.title.pl || '(missing)');
      console.log('  EN:', deal.title.en || '(missing)');
      console.log('  DE:', deal.title.de || '(missing)');
    } else {
      console.log('  Value:', deal.title);
    }
    console.log('');
  });
  
  // Check product_cores too
  console.log('\n=== Checking Product Cores ===\n');
  const coresSnap = await db.collection('product_cores')
    .where('status', '==', 'approved')
    .limit(3)
    .get();
  
  if (coresSnap.empty) {
    console.log('❌ No approved product cores found');
    return;
  }
  
  console.log(`Found ${coresSnap.size} approved product cores\n`);
  
  coresSnap.forEach((doc, idx) => {
    const product = doc.data();
    console.log(`=== Product ${idx + 1} (${doc.id}) ===`);
    console.log('Categories:');
    console.log('  mainCategorySlug:', product.mainCategorySlug || '(missing)');
    console.log('  subCategorySlug:', product.subCategorySlug || '(missing)');
    console.log('  subSubCategorySlug:', product.subSubCategorySlug || '(missing)');
    console.log('\nTitle:');
    console.log('  Type:', typeof product.title);
    if (typeof product.title === 'object') {
      console.log('  PL:', product.title.pl || '(missing)');
      console.log('  EN:', product.title.en || '(missing)');
      console.log('  DE:', product.title.de || '(missing)');
    } else {
      console.log('  Value:', product.title);
    }
    console.log('');
  });
}

checkDeal().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
