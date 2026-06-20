import 'dotenv/config';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { queueProductsForIndexing, queueDealsForIndexing } from '../src/search/typesenseQueue';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  if (!getApps().length) {
    const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      console.log('🔑 Using local serviceAccountKey.json');
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      console.log('☁️ Using environment credentials');
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'okazje-plus'
      });
    }
  }

  const db = getFirestore();

  console.log('Fetching all product cores...');
  const productsSnap = await db.collection('product_cores').get();
  const productIds = productsSnap.docs.map(doc => doc.id);
  console.log(`Found ${productIds.length} product cores.`);

  console.log('Fetching all deals...');
  const dealsSnap = await db.collection('deals').get();
  const dealIds = dealsSnap.docs.map(doc => doc.id);
  console.log(`Found ${dealIds.length} deals.`);

  if (productIds.length > 0) {
    console.log('Queueing products for indexing...');
    await queueProductsForIndexing(productIds);
  }

  if (dealIds.length > 0) {
    console.log('Queueing deals for indexing...');
    await queueDealsForIndexing(dealIds);
  }

  console.log('✅ All existing records enqueued successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
