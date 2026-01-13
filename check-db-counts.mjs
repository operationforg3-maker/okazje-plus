import { adminDb } from './src/lib/firebase-admin.ts';

async function checkCounts() {
  try {
    const [dealsSnap, productCoresSnap, categoriesSnap] = await Promise.all([
      adminDb.collection('deals').count().get(),
      adminDb.collection('product_cores').count().get(),
      adminDb.collection('categories').count().get(),
    ]);

    console.log('📊 Database counts:');
    console.log(`  Deals: ${dealsSnap.data().count}`);
    console.log(`  ProductCores: ${productCoresSnap.data().count}`);
    console.log(`  Categories: ${categoriesSnap.data().count}`);
    
    // Sample data
    const dealsSample = await adminDb.collection('deals').limit(3).get();
    const productsSample = await adminDb.collection('product_cores').limit(3).get();
    
    console.log('\n📦 Sample Deals:');
    dealsSample.docs.forEach((doc, i) => {
      const d = doc.data();
      console.log(`  ${i+1}. [${d.status}] ${typeof d.title === 'object' ? d.title?.pl : d.title?.substring?.(0, 50)}`);
    });
    
    console.log('\n📦 Sample ProductCores:');
    productsSample.docs.forEach((doc, i) => {
      const p = doc.data();
      console.log(`  ${i+1}. [${p.status}] ${typeof p.title === 'object' ? p.title?.pl : p.title?.substring?.(0, 50)}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  }
  
  process.exit(0);
}

checkCounts();
