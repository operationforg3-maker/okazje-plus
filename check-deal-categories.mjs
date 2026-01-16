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

async function checkDealCategories() {
  console.log('\n=== Sprawdzam jakie kategorie mają deale ===\n');
  
  // Pobierz pierwsze 20 dealów
  const deals = await db.collection('deals')
    .where('status', '==', 'approved')
    .limit(20)
    .get();
  
  console.log(`Znaleziono ${deals.size} approved dealów\n`);
  
  const categories = new Map();
  
  deals.docs.forEach(doc => {
    const data = doc.data();
    const main = data.mainCategorySlug || 'BRAK';
    const sub = data.subCategorySlug || 'BRAK';
    const subsub = data.subSubCategorySlug || 'BRAK';
    
    const key = `${main} / ${sub} / ${subsub}`;
    categories.set(key, (categories.get(key) || 0) + 1);
  });
  
  console.log('Kategorie dealów:');
  Array.from(categories.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
  
  console.log('\n');
}

checkDealCategories().catch(console.error);
