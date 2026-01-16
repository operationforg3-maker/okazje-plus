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

async function checkDealsHierarchy() {
  console.log('\n=== Sprawdzam deale na każdym poziomie kategorii ===\n');
  
  // Main category
  const mainDeals = await db.collection('deals')
    .where('mainCategorySlug', '==', 'electronics')
    .where('status', '==', 'approved')
    .get();
  
  console.log(`📦 Deale w MAIN kategorii (electronics): ${mainDeals.size}`);
  
  // Sub category
  const subDeals = await db.collection('deals')
    .where('subCategorySlug', '==', 'audio-and-video')
    .where('status', '==', 'approved')
    .get();
  
  console.log(`  📂 Deale w SUB kategorii (audio-and-video): ${subDeals.size}`);
  
  // Sub-sub category
  const subSubDeals = await db.collection('deals')
    .where('subSubCategorySlug', '==', 'headphones')
    .where('status', '==', 'approved')
    .get();
  
  console.log(`    📄 Deale w SUBSUB kategorii (headphones): ${subSubDeals.size}`);
  
  console.log('\n=== Hierarchia ===\n');
  
  // Sprawdź czy subsub deale są zawarte w sub
  const subDealsIds = new Set(subDeals.docs.map(d => d.id));
  const subSubInSub = subSubDeals.docs.filter(d => subDealsIds.has(d.id)).length;
  console.log(`Czy subsub deale są zainkludowane w sub zapytaniu? ${subSubInSub}/${subSubDeals.size}`);
  
  // Sprawdź czy sub deale są zawarte w main
  const mainDealsIds = new Set(mainDeals.docs.map(d => d.id));
  const subInMain = subDeals.docs.filter(d => mainDealsIds.has(d.id)).length;
  console.log(`Czy sub deale są zainkludowane w main zapytaniu? ${subInMain}/${subDeals.size}`);
  
  console.log('\n');
}

checkDealsHierarchy().catch(console.error);
