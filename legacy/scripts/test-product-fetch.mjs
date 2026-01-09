#!/usr/bin/env node
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const productId = 'zVMBPWFJrrrPsxHTCYF6';

async function checkProduct() {
  try {
    console.log(`Checking product: ${productId}\n`);

    // Check product_cores
    const coreRef = doc(db, 'product_cores', productId);
    const coreSnap = await getDoc(coreRef);

    if (coreSnap.exists()) {
      const data = coreSnap.data();
      console.log('✓ ProductCore found:');
      console.log(`  status: ${data.status}`);
      console.log(`  title: ${typeof data.title === 'object' ? JSON.stringify(data.title).slice(0, 80) : data.title}`);
      console.log(`  images: ${Array.isArray(data.images) ? `array[${data.images.length}]` : data.images}`);
      console.log(`  bestPrice: ${JSON.stringify(data.bestPrice).slice(0, 100)}`);
      console.log(`  Has description: ${!!data.description}`);
      console.log(`  JSON stringifiable: ${Boolean(JSON.stringify(data).length)}`);
    } else {
      console.log('✗ ProductCore NOT found');
    }

    // Also check legacy product
    const legacyRef = doc(db, 'products', productId);
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      console.log('\n✓ Legacy product found - fallback available');
    } else {
      console.log('\n✗ Legacy product NOT found');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

checkProduct();
