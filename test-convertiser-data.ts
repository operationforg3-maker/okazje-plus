import { adminDb } from './src/lib/firebase-admin';

async function checkConvertiserData() {
  console.log('🔍 Sprawdzam dane Convertiser w Firestore...\n');

  // Pobierz ostatni ProductCore z Convertiser (bez orderBy - wymaga indexu)
  const productsSnap = await adminDb
    .collection('product_cores')
    .where('metadata.source', '==', 'convertiser')
    .limit(1)
    .get();

  if (productsSnap.empty) {
    console.log('❌ Brak produktów z Convertiser w bazie');
    process.exit(0);
  }

  const productDoc = productsSnap.docs[0];
  const product = productDoc.data();

  console.log('📦 PRODUCT CORE (immutable):');
  console.log('  ID:', productDoc.id);
  console.log('  Title PL:', product.title?.pl || '❌ BRAK');
  console.log('  Title EN:', product.title?.en || '❌ BRAK');
  console.log('  Title DE:', product.title?.de || '❌ BRAK');
  console.log('');
  console.log('  Full Description PL:', product.fullDescription?.pl 
    ? `✅ JEST (${product.fullDescription.pl.length} chars)` 
    : '❌ BRAK');
  console.log('  Full Description EN:', product.fullDescription?.en 
    ? `✅ JEST (${product.fullDescription.en.length} chars)` 
    : '❌ BRAK');
  console.log('  Full Description DE:', product.fullDescription?.de 
    ? `✅ JEST (${product.fullDescription.de.length} chars)` 
    : '❌ BRAK');
  console.log('');
  console.log('  Status:', product.status);
  console.log('  AI Quality Score:', product.aiQualityScore || '❌ BRAK');
  console.log('  Category:', product.mainCategorySlug + '/' + product.subCategorySlug);

  // Pobierz powiązane Deals
  const dealsSnap = await adminDb
    .collection('deals')
    .where('productCoreId', '==', productDoc.id)
    .get();

  console.log('\n💰 DEALS (mutable, ' + dealsSnap.size + ' total):');
  
  if (dealsSnap.empty) {
    console.log('  ❌ Brak powiązanych deals!');
  } else {
    dealsSnap.docs.forEach((dealDoc, i) => {
      const deal = dealDoc.data();
      console.log(`\n  Deal #${i + 1}:`);
      console.log('    ID:', dealDoc.id);
      console.log('    Source:', deal.source);
      console.log('    Price:', deal.price?.amount || deal.legacyPrice, deal.price?.currency || 'PLN');
      console.log('    Original Price:', deal.originalPrice || 'brak');
      console.log('    Merchant:', deal.merchant?.name || deal.metadata?.store?.name || 'brak');
      console.log('    Link:', (deal.sourceLink || deal.metadata?.originalUrl || 'brak').substring(0, 60) + '...');
      console.log('    Status:', deal.status);
    });
  }

  console.log('\n✅ Sprawdzanie zakończone');
}

checkConvertiserData().catch(console.error);
