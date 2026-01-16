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

async function checkCategoryIds() {
  console.log('\n=== Sprawdzam ID vs Slug kategorii ===\n');
  
  const cats = await db.collection('categories').limit(5).get();
  
  cats.docs.forEach(doc => {
    const data = doc.data();
    console.log(`ID: "${doc.id}"`);
    console.log(`  slug: "${data.slug}"`);
    console.log(`  name: "${data.name}"`);
    console.log();
  });
}

checkCategoryIds().catch(console.error);
