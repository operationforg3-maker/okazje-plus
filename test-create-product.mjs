// test-create-product.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function testCreateProduct() {
  console.log('🧪 Testing product creation...\n');

  try {
    const testProduct = {
      name: 'Test Product 123',
      title: { pl: 'Testowy Produkt', en: 'Test Product' },
      description: 'Test description',
      image: 'https://via.placeholder.com/300',
      price: {
        amount: 99.99,
        currency: 'PLN',
        totalPrice: 99.99,
      },
      mainCategorySlug: 'test',
      subCategorySlug: 'test-sub',
      status: 'approved',
      createdAt: new Date(),
      temperature: 0,
      upvotes: 0,
      downvotes: 0,
      views: 0,
      clicks: 0,
      shares: 0,
      commentsCount: 0,
    };

    console.log('Creating product...');
    const ref = await db.collection('products').add(testProduct);
    console.log(`✅ Created with ID: ${ref.id}\n`);

    // Verify
    const doc = await ref.get();
    if (doc.exists) {
      console.log('✅ Product verified in Firestore');
      console.log(`Data: ${JSON.stringify(doc.data(), null, 2)}`);
    } else {
      console.log('❌ Product not found after creation');
    }

    // Count products
    const count = await db.collection('products').count().get();
    console.log(`\n📊 Total products in DB: ${count.data().count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testCreateProduct();
