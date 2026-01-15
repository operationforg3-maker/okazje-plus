const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function checkProductCategories() {
  const snapshot = await db.collection('product_cores').limit(10).get();
  
  console.log(`=== PRODUCT CATEGORY ASSIGNMENT (first 10 products) ===\n`);

  if (snapshot.empty) {
    console.log('No products found');
    process.exit(1);
  }

  const categoryAssignments = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    categoryAssignments.push({
      id: doc.id,
      mainCategorySlug: data.mainCategorySlug,
      subCategorySlug: data.subCategorySlug,
      subSubCategorySlug: data.subSubCategorySlug,
      title: (data.title?.substring(0, 40) || 'N/A').replace(/\n/g, ' ')
    });
  });

  categoryAssignments.forEach((cat, i) => {
    console.log(`${i + 1}. ${cat.title}...`);
    console.log(`   Main: ${cat.mainCategorySlug || '❌ MISSING'}`);
    console.log(`   Sub: ${cat.subCategorySlug || '❌ MISSING'}`);
    console.log(`   SubSub: ${cat.subSubCategorySlug || '❌ MISSING'}`);
    console.log();
  });

  const allHave3Levels = categoryAssignments.every(c => 
    c.mainCategorySlug && c.subCategorySlug && c.subSubCategorySlug
  );

  console.log(`✅ Summary`);
  console.log(`   All products have 3-level categories: ${allHave3Levels ? 'YES ✓' : 'NO ✗'}`);

  process.exit(0);
}

checkProductCategories().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
