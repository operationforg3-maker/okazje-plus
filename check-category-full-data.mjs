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

async function checkCategoryFields() {
  console.log('\n=== Sprawdzam wszystkie pola kategorii ===\n');
  
  const mainDoc = await db.collection('categories').doc('automotive').get();
  
  if (mainDoc.exists) {
    const data = mainDoc.data();
    console.log('📦 Kategoria: automotive');
    console.log('   Wszystkie pola:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkCategoryFields().catch(console.error);
