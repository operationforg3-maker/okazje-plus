const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  console.log('🔍 Connecting to project:', serviceAccount.project_id);
  
  const count = await db.collection('products').count().get();
  const totalProducts = count.data().count;
  console.log('✅ Total products:', totalProducts);
  
  if (totalProducts === 0) {
    console.log('❌ NO PRODUCTS!');
    process.exit(1);
  }
  
  console.log('\n📊 Checking 5 recent products...\n');
  const products = await db.collection('products')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  
  let categoryOK = 0, imageOK = 0, priceOK = 0;
  
  products.docs.forEach((doc, i) => {
    const p = doc.data();
    console.log(`[${i+1}] ${p.title?.pl?.substring(0, 50) || 'NO TITLE'}`);
    
    // Category
    if (p.categoryName && p.mainCategorySlug) {
      console.log(`    ✅ Category: ${p.categoryName} / ${p.subcategoryName}`);
      categoryOK++;
    } else {
      console.log(`    ❌ Category missing!`);
    }
    
    // Image
    if (p.image) {
      console.log(`    ✅ Image: ${p.image.substring(0, 60)}...`);
      imageOK++;
    } else {
      console.log(`    ❌ No image!`);
    }
    
    // Price
    if (p.price?.amount && p.price.currency === 'PLN') {
      console.log(`    ✅ Price: ${p.price.amount} PLN`);
      priceOK++;
    } else {
      console.log(`    ❌ Invalid price`);
    }
  });
  
  console.log(`\n✨ SUMMARY: ${categoryOK}/5 categories ✅ | ${imageOK}/5 images ✅ | ${priceOK}/5 prices ✅`);
  process.exit(0);
})().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
