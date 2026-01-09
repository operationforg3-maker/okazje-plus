const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkTitles() {
  console.log('=== TYTUŁY I KATEGORIE PRODUKTÓW ===\n');
  
  const productsSnap = await db.collection('products')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  productsSnap.forEach((doc, idx) => {
    const p = doc.data();
    console.log(`${idx + 1}. Tytuł: ${JSON.stringify(p.title)}`);
    console.log(`   Kategorie: ${p.mainCategorySlug}/${p.subCategorySlug}/${p.subSubCategorySlug}`);
    console.log(`   Galeria: ${p.gallery?.length || 0} zdjęć`);
    console.log();
  });
  
  console.log('\n=== TYTUŁY I KATEGORIE OKAZJI ===\n');
  
  const dealsSnap = await db.collection('deals')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  if (dealsSnap.size === 0) {
    console.log('❌ BRAK OKAZJI W BAZIE - należy uruchomić import!');
  } else {
    dealsSnap.forEach((doc, idx) => {
      const d = doc.data();
      console.log(`${idx + 1}. Tytuł: ${JSON.stringify(d.title)}`);
      console.log(`   Kategorie: ${d.mainCategorySlug}/${d.subCategorySlug}/${d.subSubCategorySlug}`);
      console.log(`   Temperatura: ${d.temperature}° | Zniżka: ${d.discount}%`);
      console.log(`   Galeria: ${d.gallery?.length || 0} zdjęć`);
      console.log();
    });
  }
  
  process.exit(0);
}

checkTitles().catch(console.error);
