#!/usr/bin/env node
/**
 * Skrypt diagnostyczny: Sprawdza deale w Firestore
 * - Czy mają poprawne kategorie (main/sub/sub-sub)
 * - Czy slugi są po angielsku
 * - Statystyki i podsumowanie
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicjalizacja Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();

async function checkDeals() {
  console.log('🔍 Sprawdzam deale w Firestore...\n');

  const dealsRef = db.collection('deals');
  const snapshot = await dealsRef.orderBy('createdAt', 'desc').limit(100).get();

  if (snapshot.empty) {
    console.log('❌ Brak deali w bazie!');
    return;
  }

  console.log(`📊 Znaleziono ${snapshot.size} deali (ostatnie 100)\n`);

  const stats = {
    total: snapshot.size,
    withMainSlug: 0,
    withSubSlug: 0,
    withSubSubSlug: 0,
    withAllSlugs: 0,
    missingCategories: 0,
    byStatus: {},
    bySource: {},
    categoryPaths: new Set(),
  };

  const examples = [];

  snapshot.forEach((doc) => {
    const deal = doc.data();
    const mainSlug = deal.mainCategorySlug;
    const subSlug = deal.subCategorySlug;
    const subSubSlug = deal.subSubCategorySlug;
    const status = deal.status || 'unknown';
    const source = deal.source || 'unknown';

    // Statystyki statusów
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    stats.bySource[source] = (stats.bySource[source] || 0) + 1;

    // Sprawdź kompletność kategorii
    if (mainSlug) stats.withMainSlug++;
    if (subSlug) stats.withSubSlug++;
    if (subSubSlug) stats.withSubSubSlug++;

    if (mainSlug && subSlug && subSubSlug) {
      stats.withAllSlugs++;
      const path = `${mainSlug}/${subSlug}/${subSubSlug}`;
      stats.categoryPaths.add(path);
    } else if (!mainSlug && !subSlug && !subSubSlug) {
      stats.missingCategories++;
    }

    // Zapisz przykłady (pierwsze 5)
    if (examples.length < 5) {
      examples.push({
        id: doc.id,
        title: deal.title?.substring(0, 60) || 'Brak tytułu',
        mainSlug: mainSlug || '❌',
        subSlug: subSlug || '❌',
        subSubSlug: subSubSlug || '❌',
        category: deal.category || '❌',
        status,
        source,
        price: deal.price || 0,
      });
    }
  });

  // Wyświetl statystyki
  console.log('📈 STATYSTYKI:');
  console.log(`   Razem deali: ${stats.total}`);
  console.log(`   Z mainCategorySlug: ${stats.withMainSlug} (${Math.round((stats.withMainSlug / stats.total) * 100)}%)`);
  console.log(`   Z subCategorySlug: ${stats.withSubSlug} (${Math.round((stats.withSubSlug / stats.total) * 100)}%)`);
  console.log(`   Z subSubCategorySlug: ${stats.withSubSubSlug} (${Math.round((stats.withSubSubSlug / stats.total) * 100)}%)`);
  console.log(`   Z WSZYSTKIMI slugami: ${stats.withAllSlugs} (${Math.round((stats.withAllSlugs / stats.total) * 100)}%)`);
  console.log(`   Bez kategorii: ${stats.missingCategories}`);
  console.log('');

  console.log('📋 STATUS:');
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  console.log('');

  console.log('🔗 ŹRÓDŁA:');
  Object.entries(stats.bySource).forEach(([source, count]) => {
    console.log(`   ${source}: ${count}`);
  });
  console.log('');

  console.log('🗂️  UNIKALNE ŚCIEŻKI KATEGORII:');
  if (stats.categoryPaths.size > 0) {
    Array.from(stats.categoryPaths).slice(0, 20).forEach((path) => {
      console.log(`   📁 ${path}`);
    });
    if (stats.categoryPaths.size > 20) {
      console.log(`   ... i ${stats.categoryPaths.size - 20} więcej`);
    }
  } else {
    console.log('   Brak pełnych ścieżek kategorii!');
  }
  console.log('');

  console.log('📝 PRZYKŁADOWE DEALE:');
  examples.forEach((deal, idx) => {
    console.log(`\n${idx + 1}. ${deal.title}`);
    console.log(`   ID: ${deal.id}`);
    console.log(`   Main: ${deal.mainSlug}`);
    console.log(`   Sub: ${deal.subSlug}`);
    console.log(`   SubSub: ${deal.subSubSlug}`);
    console.log(`   Category: ${deal.category}`);
    console.log(`   Status: ${deal.status} | Source: ${deal.source} | Price: ${deal.price} PLN`);
  });

  // Sprawdź czy slugi są po angielsku (prosta heurystyka)
  console.log('\n🔤 WERYFIKACJA JĘZYKA SLUGÓW:');
  const polishChars = /[ąćęłńóśźż]/i;
  let polishSlugsFound = 0;

  snapshot.forEach((doc) => {
    const deal = doc.data();
    const mainSlug = deal.mainCategorySlug || '';
    const subSlug = deal.subCategorySlug || '';
    const subSubSlug = deal.subSubCategorySlug || '';

    if (polishChars.test(mainSlug) || polishChars.test(subSlug) || polishChars.test(subSubSlug)) {
      polishSlugsFound++;
      if (polishSlugsFound <= 3) {
        console.log(`   ⚠️  Deal ${doc.id}: polskie znaki w slugach!`);
        console.log(`      Main: ${mainSlug} | Sub: ${subSlug} | SubSub: ${subSubSlug}`);
      }
    }
  });

  if (polishSlugsFound === 0) {
    console.log('   ✅ Wszystkie slugi są po angielsku!');
  } else {
    console.log(`   ⚠️  Znaleziono ${polishSlugsFound} deali z polskimi znakami w slugach!`);
  }

  console.log('\n✅ Sprawdzanie zakończone!');
}

checkDeals().catch((error) => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});
