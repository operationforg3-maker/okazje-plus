import admin from 'firebase-admin';
import fs from 'fs';

const serviceKey = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceKey) });
const db = admin.firestore();

async function testQuery() {
  console.log('Testing category queries...\n');
  
  // Test 1: Main category
  console.log('1️⃣  Query: mainCategorySlug = "automotive"');
  const q1 = await db.collection('deals')
    .where('status', '==', 'approved')
    .where('mainCategorySlug', '==', 'automotive')
    .limit(5)
    .get();
  console.log(`   Result: ${q1.size} deals`);
  if (q1.size > 0) console.log('   Sample:', q1.docs[0].data().mainCategorySlug, '/', q1.docs[0].data().subCategorySlug, '/', q1.docs[0].data().subSubCategorySlug);
  
  // Test 2: Sub category
  console.log('\n2️⃣  Query: mainCategorySlug = "automotive" AND subCategorySlug = "car-accessories"');
  const q2 = await db.collection('deals')
    .where('status', '==', 'approved')
    .where('mainCategorySlug', '==', 'automotive')
    .where('subCategorySlug', '==', 'car-accessories')
    .limit(5)
    .get();
  console.log(`   Result: ${q2.size} deals`);
  if (q2.size > 0) console.log('   Sample:', q2.docs[0].data().mainCategorySlug, '/', q2.docs[0].data().subCategorySlug, '/', q2.docs[0].data().subSubCategorySlug);
  
  // Test 3: Sub-sub category
  console.log('\n3️⃣  Query: mainCategorySlug = "automotive" AND subCategorySlug = "car-accessories" AND subSubCategorySlug = "phone-mounts"');
  const q3 = await db.collection('deals')
    .where('status', '==', 'approved')
    .where('mainCategorySlug', '==', 'automotive')
    .where('subCategorySlug', '==', 'car-accessories')
    .where('subSubCategorySlug', '==', 'phone-mounts')
    .limit(5)
    .get();
  console.log(`   Result: ${q3.size} deals`);
  if (q3.size > 0) console.log('   Sample:', q3.docs[0].data().mainCategorySlug, '/', q3.docs[0].data().subCategorySlug, '/', q3.docs[0].data().subSubCategorySlug);
  
  // Test 4: Check all available categories in deals
  console.log('\n4️⃣  Checking all unique categories in database...');
  const allDeals = await db.collection('deals')
    .where('status', '==', 'approved')
    .limit(100)
    .get();
  const categories = new Set();
  allDeals.docs.forEach(doc => {
    const data = doc.data();
    const cat = `${data.mainCategorySlug}/${data.subCategorySlug}/${data.subSubCategorySlug || 'none'}`;
    categories.add(cat);
  });
  console.log(`   Found ${categories.size} unique category paths:`);
  Array.from(categories).slice(0, 10).forEach(c => console.log(`   - ${c}`));
  
  process.exit(0);
}

testQuery().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
