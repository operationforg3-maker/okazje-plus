#!/usr/bin/env node
/**
 * Sprawdza strukturę kategorii w Firestore
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();

async function checkCategories() {
  console.log('🔍 Sprawdzam strukturę kategorii...\n');

  const mainCats = await db.collection('categories').orderBy('sortOrder').get();

  for (const mainDoc of mainCats.docs) {
    const main = mainDoc.data();
    console.log(`📁 ${main.name} (${main.slug})`);

    const subs = await mainDoc.ref.collection('subcategories').orderBy('sortOrder').get();
    
    if (subs.empty) {
      console.log('   ⚠️  Brak podkategorii!');
    }

    for (const subDoc of subs.docs) {
      const sub = subDoc.data();
      console.log(`   📂 ${sub.name} (${sub.slug})`);

      const subsubs = await subDoc.ref.collection('subcategories').orderBy('sortOrder').get();

      if (subsubs.empty) {
        console.log(`      ⚠️  Brak pod-podkategorii!`);
      } else {
        for (const subsubDoc of subsubs.docs) {
          const subsub = subsubDoc.data();
          console.log(`      📄 ${subsub.name} (${subsub.slug})`);
        }
      }
    }
    console.log('');
  }
}

checkCategories().catch(console.error);
