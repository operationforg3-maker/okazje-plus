import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function checkProducts() {
  try {
    const productsSnapshot = await db.collection('products').limit(10).get();
    
    console.log(`\n📦 Total products created: ${productsSnapshot.size}\n`);
    
    productsSnapshot.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`${idx + 1}. ${data.name?.substring(0, 60)}`);
      console.log(`   Category: ${data.mainCategorySlug}/${data.subCategorySlug}`);
      console.log(`   Price: ${data.price?.amount} ${data.price?.currency}`);
      console.log(`   Job: ${data.importJobId || 'N/A'}`);
      console.log(`   Created: ${data.createdAt?.toDate?.()?.toISOString() || data.createdAt}\n`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

checkProducts();
