import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// Check categories structure
const mainCats = await db.collection('categories').where('level', '==', 1).limit(10).get();
console.log('=== MAIN CATEGORIES ===');
mainCats.docs.forEach(doc => {
  const data = doc.data();
  const trans = data.translations ? Object.keys(data.translations) : [];
  console.log(`- ${data.slug}: name="${data.name}", translations=[${trans.join(',')}]`);
});

const subCats = await db.collection('categories').where('level', '==', 2).limit(10).get();
console.log('\n=== SUB CATEGORIES (first 10) ===');
subCats.docs.forEach(doc => {
  const data = doc.data();
  const trans = data.translations ? Object.keys(data.translations) : [];
  console.log(`- ${data.slug}: name="${data.name}", translations=[${trans.join(',')}]`);
});

const subSubCats = await db.collection('categories').where('level', '==', 3).limit(10).get();
console.log('\n=== SUB-SUB CATEGORIES (first 10) ===');
subSubCats.docs.forEach(doc => {
  const data = doc.data();
  const trans = data.translations ? Object.keys(data.translations) : [];
  console.log(`- ${data.slug}: name="${data.name}", translations=[${trans.join(',')}]`);
});

// Count each level
const l1 = await db.collection('categories').where('level', '==', 1).get();
const l2 = await db.collection('categories').where('level', '==', 2).get();
const l3 = await db.collection('categories').where('level', '==', 3).get();

console.log(`\n=== COUNTS ===`);
console.log(`Level 1 (main): ${l1.size}`);
console.log(`Level 2 (sub): ${l2.size}`);
console.log(`Level 3 (sub-sub): ${l3.size}`);

// Check what deal/productcore have
const dealsSnap = await db.collection('deals').limit(5).get();
console.log(`\n=== DEALS - Category Fields ===`);
dealsSnap.docs.forEach(doc => {
  const data = doc.data();
  console.log(`- mainCategorySlug="${data.mainCategorySlug}", subCategorySlug="${data.subCategorySlug}", subSubCategorySlug="${data.subSubCategorySlug || 'MISSING'}"`);
});

const productCoresSnap = await db.collection('product_cores').limit(5).get();
console.log(`\n=== PRODUCTCORES - Category Fields ===`);
productCoresSnap.docs.forEach(doc => {
  const data = doc.data();
  console.log(`- mainCategorySlug="${data.mainCategorySlug}", subCategorySlug="${data.subCategorySlug}", subSubCategorySlug="${data.subSubCategorySlug || 'MISSING'}"`);
});

process.exit(0);
