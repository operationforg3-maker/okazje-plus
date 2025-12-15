const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkImports() {
  console.log('=== ANALIZA IMPORTÓW - PRODUKTY ===\n');
  
  const productsSnap = await db.collection('products')
    .orderBy('createdAt', 'desc')
    .limit(15)
    .get();
  
  console.log(`Znaleziono ${productsSnap.size} produktów\n`);
  
  let missingSubSub = 0;
  let missingGallery = 0;
  let missingCategories = 0;
  let hasGalleryMultiple = 0;
  
  productsSnap.forEach((doc, idx) => {
    const p = doc.data();
    const title = String(p.title || 'Brak tytułu').substring(0, 60);
    console.log(`${idx + 1}. ${title}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Kategorie: ${p.mainCategorySlug || '❌'}/${p.subCategorySlug || '❌'}/${p.subSubCategorySlug || '❌'}`);
    console.log(`   Zdjęcia: ${p.image ? '✅' : '❌'} | Galeria: ${p.gallery?.length || 0} zdjęć`);
    console.log(`   Źródło: ${p.source || 'brak'} | Status: ${p.status || 'brak'}`);
    
    if (!p.subSubCategorySlug) missingSubSub++;
    if (!p.gallery || p.gallery.length === 0) missingGallery++;
    if (p.gallery && p.gallery.length > 1) hasGalleryMultiple++;
    if (!p.mainCategorySlug || !p.subCategorySlug) missingCategories++;
  });
  
  console.log('\n=== ANALIZA IMPORTÓW - OKAZJE ===\n');
  
  const dealsSnap = await db.collection('deals')
    .orderBy('createdAt', 'desc')
    .limit(15)
    .get();
  
  console.log(`Znaleziono ${dealsSnap.size} okazji\n`);
  
  let dealsMissingSubSub = 0;
  let dealsMissingGallery = 0;
  let dealsMissingCategories = 0;
  let dealsHasGalleryMultiple = 0;
  
  dealsSnap.forEach((doc, idx) => {
    const d = doc.data();
    const title = String(d.title || 'Brak tytułu').substring(0, 60);
    console.log(`${idx + 1}. ${title}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Kategorie: ${d.mainCategorySlug || '❌'}/${d.subCategorySlug || '❌'}/${d.subSubCategorySlug || '❌'}`);
    console.log(`   Zdjęcia: ${d.image ? '✅' : '❌'} | Galeria: ${d.gallery?.length || 0} zdjęć`);
    console.log(`   Źródło: ${d.source || 'brak'} | Temperatura: ${d.temperature || 0}°`);
    console.log(`   Zniżka: ${d.discount || 0}% | Cena: ${d.price || 0} PLN`);
    
    if (!d.subSubCategorySlug) dealsMissingSubSub++;
    if (!d.gallery || d.gallery.length === 0) dealsMissingGallery++;
    if (d.gallery && d.gallery.length > 1) dealsHasGalleryMultiple++;
    if (!d.mainCategorySlug || !d.subCategorySlug) dealsMissingCategories++;
  });
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         PODSUMOWANIE PROBLEMÓW DO NAPRAWY                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('📦 PRODUKTY:');
  console.log(`  ❌ Brak subSubCategorySlug: ${missingSubSub}/${productsSnap.size} (${Math.round(missingSubSub/productsSnap.size*100)}%)`);
  console.log(`  📸 Brak galerii: ${missingGallery}/${productsSnap.size} (${Math.round(missingGallery/productsSnap.size*100)}%)`);
  console.log(`  ✅ Ma galerię (>1 zdjęcie): ${hasGalleryMultiple}/${productsSnap.size}`);
  console.log(`  🚨 Brak kategorii (main/sub): ${missingCategories}/${productsSnap.size}\n`);
  
  console.log('🔥 OKAZJE:');
  console.log(`  ❌ Brak subSubCategorySlug: ${dealsMissingSubSub}/${dealsSnap.size} (${Math.round(dealsMissingSubSub/dealsSnap.size*100)}%)`);
  console.log(`  📸 Brak galerii: ${dealsMissingGallery}/${dealsSnap.size} (${Math.round(dealsMissingGallery/dealsSnap.size*100)}%)`);
  console.log(`  ✅ Ma galerię (>1 zdjęcie): ${dealsHasGalleryMultiple}/${dealsSnap.size}`);
  console.log(`  🚨 Brak kategorii (main/sub): ${dealsMissingCategories}/${dealsSnap.size}\n`);
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              CO TRZEBA POPRAWIĆ:                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  if (missingSubSub > 0 || dealsMissingSubSub > 0) {
    console.log('1️⃣  BRAK subSubCategorySlug w większości produktów/okazji');
    console.log('    → AI kategoryzacja nie zwraca 3. poziomu');
    console.log('    → Należy poprawić aiSuggestCategory() w przepływie importu\n');
  }
  
  if (missingGallery > productsSnap.size * 0.5 || dealsMissingGallery > dealsSnap.size * 0.5) {
    console.log('2️⃣  BRAK galerii w większości elementów');
    console.log('    → Stara logika zapisu nie tworzyła pola gallery');
    console.log('    → Nowa logika powinna działać dla świeżych importów\n');
  }
  
  if (hasGalleryMultiple > 0) {
    console.log('✅ Niektóre produkty MAJ Ą wieloobrazową galerię - nowa logika działa!\n');
  }
  
  process.exit(0);
}

checkImports().catch(console.error);
