// check-imports.mjs - Quick diagnostic for import jobs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
let app;
try {
  const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
  app = initializeApp({
    credential: cert(serviceAccount)
  });
} catch (e) {
  console.error('❌ Failed to load serviceAccountKey.json:', e.message);
  process.exit(1);
}

const db = getFirestore(app);

async function checkImports() {
  console.log('🔍 Checking import jobs...\n');

  try {
    // Get last 5 import jobs
    const jobsSnapshot = await db.collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    console.log(`📊 Found ${jobsSnapshot.size} recent import jobs:\n`);

    jobsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`--- Job ${index + 1}: ${doc.id} ---`);
      console.log(`Type: ${data.type}`);
      console.log(`Importer: ${data.importerType || 'N/A'}`);
      console.log(`Status: ${data.status}`);
      console.log(`Created: ${data.createdAt?.toDate?.()?.toISOString() || data.createdAt}`);
      console.log(`Progress: ${JSON.stringify(data.progress || {})}`);
      console.log(`Batches: ${data.batches?.length || 0}`);
      console.log(`Items Created: ${data.itemsCreated?.length || 0}`);
      console.log(`Items Updated: ${data.itemsUpdated?.length || 0}`);
      
      if (data.error) {
        console.log(`❌ Error: ${data.error}`);
      }
      
      if (data.logs && data.logs.length > 0) {
        console.log(`📝 Last 3 logs:`);
        data.logs.slice(-3).forEach(log => {
          console.log(`  - ${typeof log === 'object' ? JSON.stringify(log) : log}`);
        });
      }
      console.log('');
    });

    // Check products count
    const productsCount = await db.collection('products').count().get();
    console.log(`\n📦 Total products in DB: ${productsCount.data().count}`);

    // Check deals count
    const dealsCount = await db.collection('deals').count().get();
    console.log(`🔥 Total deals in DB: ${dealsCount.data().count}`);

    // Get last 3 products
    const productsSnapshot = await db.collection('products')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();

    if (productsSnapshot.size > 0) {
      console.log(`\n📦 Last ${productsSnapshot.size} products:`);
      productsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`  ${index + 1}. ${data.name} (${data.mainCategorySlug}/${data.subCategorySlug}) - ${data.createdAt?.toDate?.()?.toISOString()}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking imports:', error);
  }

  process.exit(0);
}

checkImports();
