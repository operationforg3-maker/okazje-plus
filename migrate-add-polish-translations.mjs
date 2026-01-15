#!/usr/bin/env node
/**
 * Migration Script: Add Polish translations to all categories
 * 
 * Problem: Categories have Polish names in main `name` field but missing `translations.pl`
 * Solution: Copy `name` to `translations.pl.name` for all 3 levels
 */

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

async function addPolishTranslations() {
  console.log('\n🔧 Migrating categories to add Polish translations...\n');
  
  let mainCount = 0;
  let subCount = 0;
  let subSubCount = 0;
  
  // Get all main categories
  const mainCategories = await db.collection('categories').get();
  
  for (const mainDoc of mainCategories.docs) {
    const mainData = mainDoc.data();
    
    // Update main category if missing pl translation
    if (!mainData.translations?.pl?.name && mainData.name) {
      console.log(`📦 Updating main: ${mainDoc.id} (${mainData.name})`);
      
      await mainDoc.ref.update({
        'translations.pl.name': mainData.name,
        'translations.pl.description': mainData.description || '',
      });
      mainCount++;
    }
    
    // Get all subcategories
    const subCategories = await mainDoc.ref.collection('subcategories').get();
    
    for (const subDoc of subCategories.docs) {
      const subData = subDoc.data();
      
      // Update subcategory if missing pl translation
      if (!subData.translations?.pl?.name && subData.name) {
        console.log(`  📂 Updating sub: ${mainDoc.id}/${subDoc.id} (${subData.name})`);
        
        await subDoc.ref.update({
          'translations.pl.name': subData.name,
        });
        subCount++;
      }
      
      // Get all sub-subcategories
      const subSubCategories = await subDoc.ref.collection('subcategories').get();
      
      for (const subSubDoc of subSubCategories.docs) {
        const subSubData = subSubDoc.data();
        
        // Update sub-subcategory if missing pl translation
        if (!subSubData.translations?.pl?.name && subSubData.name) {
          console.log(`    📄 Updating subsub: ${mainDoc.id}/${subDoc.id}/${subSubDoc.id} (${subSubData.name})`);
          
          await subSubDoc.ref.update({
            'translations.pl.name': subSubData.name,
          });
          subSubCount++;
        }
      }
    }
  }
  
  console.log('\n✅ Migration complete!');
  console.log(`   Main categories updated: ${mainCount}`);
  console.log(`   Subcategories updated: ${subCount}`);
  console.log(`   Sub-subcategories updated: ${subSubCount}`);
  console.log(`   Total: ${mainCount + subCount + subSubCount}\n`);
}

addPolishTranslations().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
