import admin from 'firebase-admin';
import fs from 'fs';
import axios from 'axios';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

// Connect to okazje-plus (which ADC on App Hosting maps to okazje-plus-project)
admin.initializeApp({ 
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus-project'
});

const db = admin.firestore();

async function testImports() {
  console.log('📊 CHECKING IMPORT QUALITY...\n');
  
  try {
    // 1. Total product count
    const countResult = await db.collection('products').count().get();
    const totalProducts = countResult.data().count;
    console.log(`📦 Total products in DB: ${totalProducts}`);
    
    if (totalProducts === 0) {
      console.log('❌ NO PRODUCTS FOUND!');
      process.exit(1);
    }
    
    // 2. Sample 10 recent products
    console.log('\n🔍 Checking 10 recent products...\n');
    const products = await db.collection('products')
      .orderBy('metadata.importedAt', 'desc')
      .limit(10)
      .get();
    
    let categoryIssues = 0;
    let imageIssues = 0;
    let validProducts = 0;
    const imageUrls = [];
    
    for (const doc of products.docs) {
      const p = doc.data();
      const id = doc.id;
      
      console.log(`\n[${id.substring(0, 8)}...] ${p.title?.pl?.substring(0, 50) || 'NO TITLE'}`);
      
      // Check category
      if (!p.categoryName || !p.mainCategorySlug) {
        console.log(`  ❌ MISSING CATEGORY: categoryName="${p.categoryName}", mainCategorySlug="${p.mainCategorySlug}"`);
        categoryIssues++;
      } else {
        console.log(`  ✅ Category: ${p.categoryName} / ${p.subcategoryName}`);
        console.log(`     Slugs: ${p.mainCategorySlug}/${p.subCategorySlug}`);
      }
      
      // Check image
      if (!p.image) {
        console.log(`  ❌ NO IMAGE`);
        imageIssues++;
      } else {
        console.log(`  ✅ Image: ${p.image.substring(0, 80)}...`);
        imageUrls.push({ id, url: p.image, title: p.title?.pl });
      }
      
      // Check price
      if (p.price?.amount && p.price.currency === 'PLN') {
        console.log(`  ✅ Price: ${p.price.amount} ${p.price.currency}`);
        validProducts++;
      } else {
        console.log(`  ❌ INVALID PRICE: ${JSON.stringify(p.price)}`);
      }
      
      // Check status
      console.log(`  📌 Status: ${p.status}`);
    }
    
    console.log(`\n\n📈 SUMMARY OF 10 PRODUCTS:`);
    console.log(`  ✅ Valid: ${validProducts}/10`);
    console.log(`  ❌ Category issues: ${categoryIssues}`);
    console.log(`  ❌ Image issues: ${imageIssues}`);
    
    // 3. Test image URLs
    if (imageUrls.length > 0) {
      console.log(`\n🖼️  TESTING ${Math.min(3, imageUrls.length)} IMAGE URLs...\n`);
      
      for (let i = 0; i < Math.min(3, imageUrls.length); i++) {
        const { id, url, title } = imageUrls[i];
        try {
          const response = await axios.head(url, { timeout: 5000 });
          console.log(`✅ [${i+1}] ${title?.substring(0, 40)}`);
          console.log(`   Status: ${response.status}, Size: ${response.headers['content-length'] || '?'} bytes`);
        } catch (e) {
          console.log(`❌ [${i+1}] ${title?.substring(0, 40)}`);
          console.log(`   Error: ${e.message}`);
        }
      }
    }
    
    // 4. Check categories distribution
    console.log(`\n📂 CATEGORY DISTRIBUTION (top 10)...\n`);
    const categoryStats = await db.collection('products')
      .select('mainCategorySlug', 'categoryName')
      .limit(100)
      .get();
    
    const categories = {};
    categoryStats.docs.forEach(doc => {
      const data = doc.data();
      const key = data.categoryName || data.mainCategorySlug || 'UNCATEGORIZED';
      categories[key] = (categories[key] || 0) + 1;
    });
    
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([cat, count]) => {
        console.log(`  📁 ${cat}: ${count} products`);
      });
    
    console.log('\n✨ IMPORT CHECK COMPLETE!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testImports();
