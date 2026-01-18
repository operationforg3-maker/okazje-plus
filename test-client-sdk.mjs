// Test what Client SDK returns for timestamps
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';

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

async function test() {
  const q = query(collection(db, 'product_cores'), where('status', '==', 'approved'), limit(1));
  const snap = await getDocs(q);
  const doc = snap.docs[0];
  if (!doc) {
    console.log('No documents found');
    process.exit(1);
  }
  const data = doc.data();
  console.log('Client SDK updatedAt:');
  console.log('  typeof:', typeof data.updatedAt);
  console.log('  constructor:', data.updatedAt?.constructor?.name);
  console.log('  value:', data.updatedAt);
  process.exit(0);
}

test();
