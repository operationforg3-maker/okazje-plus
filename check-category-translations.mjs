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

async function checkCategoryTranslations() {
  console.log('\n=== Sprawdzam tłumaczenia kategorii ===\n');
  
  // Sprawdź 3 główne kategorie
  const mainCategories = await db.collection('categories').limit(3).get();
  
  for (const mainDoc of mainCategories.docs) {
    const mainData = mainDoc.data();
    console.log(`\n📦 KATEGORIA GŁÓWNA: ${mainDoc.id}`);
    console.log('   Translations:');
    console.log(`     PL: ${mainData.translations?.pl?.name || 'BRAK'}`);
    console.log(`     EN: ${mainData.translations?.en?.name || 'BRAK'}`);
    console.log(`     DE: ${mainData.translations?.de?.name || 'BRAK'}`);
    
    // Sprawdź podkategorię
    const subCategories = await mainDoc.ref.collection('subcategories').limit(1).get();
    
    if (!subCategories.empty) {
      const subDoc = subCategories.docs[0];
      const subData = subDoc.data();
      console.log(`\n  📂 Podkategoria: ${subDoc.id}`);
      console.log('     Translations:');
      console.log(`       PL: ${subData.translations?.pl?.name || 'BRAK'}`);
      console.log(`       EN: ${subData.translations?.en?.name || 'BRAK'}`);
      console.log(`       DE: ${subData.translations?.de?.name || 'BRAK'}`);
      
      // Sprawdź pod-podkategorię
      const subSubCategories = await subDoc.ref.collection('subcategories').limit(1).get();
      
      if (!subSubCategories.empty) {
        const subSubDoc = subSubCategories.docs[0];
        const subSubData = subSubDoc.data();
        console.log(`\n    📄 Pod-podkategoria: ${subSubDoc.id}`);
        console.log('       Translations:');
        console.log(`         PL: ${subSubData.translations?.pl?.name || 'BRAK'}`);
        console.log(`         EN: ${subSubData.translations?.en?.name || 'BRAK'}`);
        console.log(`         DE: ${subSubData.translations?.de?.name || 'BRAK'}`);
      }
    }
  }
  
  console.log('\n=== Koniec sprawdzania ===\n');
}

checkCategoryTranslations().catch(console.error);
