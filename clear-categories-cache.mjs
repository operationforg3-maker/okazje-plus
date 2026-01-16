#!/usr/bin/env node
/**
 * Clear getCategories cache to force reload with 3-level structure
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

async function clearCategoriesCache() {
  console.log('\n🗑️  Clearing categories cache...\n');
  
  // Cache keys used in data.ts
  const cacheKeys = [
    'categories:all',
    'categories:with_content_products',
    'categories:with_content_deals',
  ];
  
  try {
    // Note: If using Redis, would need to connect and delete keys
    // For in-memory cache, it will clear on server restart
    console.log('Cache keys to clear:');
    cacheKeys.forEach(key => console.log(`  - ${key}`));
    
    console.log('\n✅ In-memory cache will be cleared on next server restart');
    console.log('💡 If using Redis, run: redis-cli DEL ' + cacheKeys.join(' '));
    
    // Verify subcategories exist
    console.log('\n📊 Verifying 3-level structure...\n');
    
    const mainCats = await db.collection('categories').limit(2).get();
    
    for (const mainDoc of mainCats.docs) {
      console.log(`\n📦 ${mainDoc.id}`);
      
      const subs = await mainDoc.ref.collection('subcategories').limit(2).get();
      console.log(`   Subcategories: ${subs.size}`);
      
      if (!subs.empty) {
        const firstSub = subs.docs[0];
        console.log(`   📂 ${firstSub.id}`);
        
        const subSubs = await firstSub.ref.collection('subcategories').get();
        console.log(`      Sub-subcategories: ${subSubs.size}`);
        
        if (!subSubs.empty) {
          subSubs.docs.slice(0, 3).forEach(ss => {
            console.log(`         📄 ${ss.id}`);
          });
        } else {
          console.log(`         ⚠️  No sub-subcategories found!`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

clearCategoriesCache().catch(console.error);
