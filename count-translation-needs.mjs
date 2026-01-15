#!/usr/bin/env node
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function countRecords() {
  console.log('\n=== Zliczam rekordy do tłumaczenia ===\n');
  
  // Count ProductCores
  const productsSnapshot = await db.collection('product_cores')
    .where('status', '==', 'approved')
    .get();
  
  console.log(`📦 ProductCores (approved): ${productsSnapshot.size}`);
  
  // Sample 3 to check if EN=PL
  let needsTranslation = 0;
  for (const doc of productsSnapshot.docs.slice(0, 10)) {
    const data = doc.data();
    if (data.title && typeof data.title === 'object') {
      if (data.title.en === data.title.pl || data.title.de === data.title.pl) {
        needsTranslation++;
      }
    }
  }
  
  console.log(`   Z próby 10: ${needsTranslation} wymaga tłumaczenia (EN=PL lub DE=PL)`);
  
  // Count Deals
  const dealsSnapshot = await db.collection('deals')
    .where('status', '==', 'approved')
    .get();
  
  console.log(`\n🏷️  Deals (approved): ${dealsSnapshot.size}`);
  
  // Sample deals to check string vs object
  let stringTitles = 0;
  let objectTitles = 0;
  
  for (const doc of dealsSnapshot.docs.slice(0, 20)) {
    const data = doc.data();
    if (typeof data.title === 'string') {
      stringTitles++;
    } else if (typeof data.title === 'object') {
      objectTitles++;
    }
  }
  
  console.log(`   Z próby 20: ${stringTitles} ma string title, ${objectTitles} ma object title`);
  
  console.log('\n=== Podsumowanie ===');
  console.log(`Produkty do przetłumaczenia (szacunkowo): ${Math.round(productsSnapshot.size * (needsTranslation / 10))}`);
  console.log(`Deale do konwersji (szacunkowo): ${Math.round(dealsSnapshot.size * (stringTitles / 20))}`);
  console.log();
}

countRecords().catch(console.error);
