import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id  // Use project from serviceAccountKey
});

const db = admin.firestore();

async function checkCollections() {
  try {
    const projectId = serviceAccount.project_id;
    console.log(`\n📊 Checking database for project: ${projectId}\n`);

    // Check deals collection
    const dealsSnapshot = await db.collection('deals').get();
    console.log(`✓ deals: ${dealsSnapshot.size} documents`);
    
    if (dealsSnapshot.size > 0) {
      console.log('  Sample deal statuses:');
      const statusCounts = {};
      dealsSnapshot.forEach(doc => {
        const status = doc.data().status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`    - ${status}: ${count}`);
      });
    }

    // Check product_cores collection
    const productCoresSnapshot = await db.collection('product_cores').get();
    console.log(`\n✓ product_cores: ${productCoresSnapshot.size} documents`);
    
    if (productCoresSnapshot.size > 0) {
      console.log('  Sample product_cores statuses:');
      const statusCounts = {};
      productCoresSnapshot.forEach(doc => {
        const status = doc.data().status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`    - ${status}: ${count}`);
      });
    }

    // Check categories collection
    const categoriesSnapshot = await db.collection('categories').get();
    console.log(`\n✓ categories: ${categoriesSnapshot.size} documents`);

    // Check product collection (legacy)
    const productsSnapshot = await db.collection('product').get();
    console.log(`✓ product (legacy): ${productsSnapshot.size} documents`);

    // Check users collection
    const usersSnapshot = await db.collection('users').get();
    console.log(`✓ users: ${usersSnapshot.size} documents`);

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total collections with data: ${[
      dealsSnapshot.size > 0,
      productCoresSnapshot.size > 0,
      categoriesSnapshot.size > 0,
      productsSnapshot.size > 0,
      usersSnapshot.size > 0
    ].filter(Boolean).length}`);
    
    if (dealsSnapshot.size === 0 && productCoresSnapshot.size === 0) {
      console.log('\n⚠️  WARNING: Both deals and product_cores are EMPTY!');
      console.log('   → You need to run Harvester to populate data');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkCollections();
