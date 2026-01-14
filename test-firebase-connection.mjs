import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus',
});

const db = admin.firestore();

async function testConnection() {
  try {
    console.log('Testing Firestore connection...');
    
    // Try to get a simple collection count
    const dealsRef = db.collection('deals');
    const snapshot = await dealsRef.limit(1).get();
    
    console.log(`✓ Connected to Firestore`);
    console.log(`✓ Found ${snapshot.size} deals (sample query)`);
    
    // Check deals collection count
    const dealsCount = await dealsRef.count().get();
    console.log(`✓ Total deals: ${dealsCount.data().count}`);
    
    // Check product_cores collection
    const productsRef = db.collection('product_cores');
    const productsCount = await productsRef.count().get();
    console.log(`✓ Total product_cores: ${productsCount.data().count}`);
    
    // Check categories
    const categoriesRef = db.collection('categories');
    const categoriesCount = await categoriesRef.count().get();
    console.log(`✓ Total categories: ${categoriesCount.data().count}`);
    
    console.log('\n✓ All collections are accessible!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error('Code:', error.code);
    process.exit(1);
  }
}

testConnection();
