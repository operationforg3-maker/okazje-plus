/**
 * Szybki skrypt dodający testowe dane do Firestore
 * Uruchom: npx tsx src/scripts/add-test-data.ts
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Inicjalizacja Firebase Admin
if (!getApps().length) {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // Fallback to application default credentials (works in Cloud environment)
    initializeApp();
  }
}

const db = getFirestore();

const testProducts = [
  {
    name: 'iPhone 15 Pro Max',
    description: 'Najnowszy smartfon Apple z chipem A17 Pro i aparatem 48MP',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'smartfony',
    price: 5999,
    affiliateLink: 'https://example.com/iphone',
    imageUrl: 'https://picsum.photos/seed/iphone15/400/300',
    status: 'approved',
    ratingCard: {
      average: 4.8,
      price: 4.5,
      quality: 5.0,
      features: 4.8,
      service: 4.6,
    },
  },
  {
    name: 'Samsung Galaxy S24 Ultra',
    description: 'Flagowy smartfon Samsung z rysikiem S Pen i teleobiektywem 10x',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'smartfony',
    price: 5499,
    affiliateLink: 'https://example.com/samsung',
    imageUrl: 'https://picsum.photos/seed/galaxys24/400/300',
    status: 'approved',
    ratingCard: {
      average: 4.7,
      price: 4.4,
      quality: 4.8,
      features: 4.9,
      service: 4.5,
    },
  },
  {
    name: 'MacBook Pro 14" M3',
    description: 'Laptop Apple z procesorem M3 Pro, 16GB RAM i 512GB SSD',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'laptopy',
    price: 8999,
    affiliateLink: 'https://example.com/macbook',
    imageUrl: 'https://picsum.photos/seed/macbookm3/400/300',
    status: 'approved',
    ratingCard: {
      average: 4.9,
      price: 4.2,
      quality: 5.0,
      features: 4.9,
      service: 4.8,
    },
  },
  {
    name: 'Sony WH-1000XM5',
    description: 'Słuchawki bezprzewodowe z aktywną redukcją szumów i 30h baterii',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'audio',
    price: 1499,
    affiliateLink: 'https://example.com/sony',
    imageUrl: 'https://picsum.photos/seed/sony1000xm5/400/300',
    status: 'approved',
    ratingCard: {
      average: 4.8,
      price: 4.6,
      quality: 4.9,
      features: 4.8,
      service: 4.7,
    },
  },
  {
    name: 'Wiertarko-wkrętarka Bosch PSR',
    description: 'Profesjonalna wiertarko-wkrętarka akumulatorowa 18V z dwoma akumulatorami',
    mainCategorySlug: 'dom-ogrod',
    subCategorySlug: 'narzedzia',
    price: 499,
    affiliateLink: 'https://example.com/bosch',
    imageUrl: 'https://picsum.photos/seed/boschpsr/400/300',
    status: 'approved',
    ratingCard: {
      average: 4.6,
      price: 4.5,
      quality: 4.7,
      features: 4.5,
      service: 4.6,
    },
  },
];

const testDeals = [
  {
    title: 'iPhone 15 Pro Max 256GB - najniższa cena w historii!',
    description: 'Mediamarkt obniżył cenę o 1000 zł! To najlepsza oferta w Polsce. Wysyłka gratis.',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'smartfony',
    price: 4999,
    originalPrice: 5999,
    affiliateLink: 'https://example.com/deal-iphone',
    imageUrl: 'https://picsum.photos/seed/dealiphone/800/600',
    status: 'approved',
    temperature: 450,
    voteCount: 87,
    commentsCount: 23,
    postedBy: 'user123',
    createdAt: new Date(),
  },
  {
    title: 'Sony WH-1000XM5 za 999 zł - ekstra okazja!',
    description: 'Słuchawki premium w genialnej cenie. Nowa wersja z jeszcze lepszym ANC.',
    mainCategorySlug: 'elektronika',
    subCategorySlug: 'audio',
    price: 999,
    originalPrice: 1499,
    affiliateLink: 'https://example.com/deal-sony',
    imageUrl: 'https://picsum.photos/seed/dealsony/800/600',
    status: 'approved',
    temperature: 380,
    voteCount: 64,
    commentsCount: 18,
    postedBy: 'dealhunter',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3h ago
  },
  {
    title: 'Wiertarko-wkrętarka Bosch za 299 zł + akumulatory gratis',
    description: 'Mega promocja w Castorama! Profesjonalne narzędzie w cenie hobbystycznej.',
    mainCategorySlug: 'dom-ogrod',
    subCategorySlug: 'narzedzia',
    price: 299,
    originalPrice: 499,
    affiliateLink: 'https://example.com/deal-bosch',
    imageUrl: 'https://picsum.photos/seed/dealbosch/800/600',
    status: 'approved',
    temperature: 520,
    voteCount: 102,
    commentsCount: 31,
    postedBy: 'toolmaster',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6h ago
  },
];

async function addTestData() {
  console.log('🚀 Dodaję testowe dane do Firestore...\n');

  // Dodaj produkty
  console.log('📦 Dodaję produkty...');
  for (const product of testProducts) {
    const ref = await db.collection('products').add(product);
    console.log(`   ✅ ${product.name} (${ref.id})`);
  }

  // Dodaj deals
  console.log('\n🔥 Dodaję okazje...');
  for (const deal of testDeals) {
    const ref = await db.collection('deals').add(deal);
    console.log(`   ✅ ${deal.title.substring(0, 50)}... (${ref.id})`);
  }

  console.log('\n✨ Gotowe! Dane testowe zostały dodane do Firestore.');
  console.log('\n💡 Teraz możesz przetestować wyszukiwanie:');
  console.log('   - "iphone" lub "smartfon"');
  console.log('   - "sony" lub "słuchawki"');
  console.log('   - "wiertarka" lub "bosch"');
  console.log('   - "macbook" lub "laptop"');
}

addTestData().catch((err) => {
  console.error('❌ Błąd:', err);
  process.exit(1);
});
