import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

async function checkDeals() {
  console.log('\n=== DEALS STATUS CHECK ===\n');
  
  try {
    // Get all deals with status breakdown
    const dealsRef = db.collection('deals');
    
    // Count all
    const allSnap = await dealsRef.count().get();
    console.log(`📊 Total deals: ${allSnap.data().count}`);
    
    // Count by status
    for (const status of ['draft', 'pending', 'approved', 'rejected']) {
      const snap = await dealsRef.where('status', '==', status).count().get();
      console.log(`  └─ ${status}: ${snap.data().count}`);
    }
    
    // Sample from draft
    console.log('\n📋 Sample DRAFT deals:');
    const draftSnap = await dealsRef.where('status', '==', 'draft').limit(3).get();
    draftSnap.forEach(doc => {
      const data = doc.data();
      console.log(`  ID: ${doc.id}`);
      console.log(`     Title: ${data.title?.pl || data.title || 'N/A'}`);
      console.log(`     Price: ${data.price?.amount || data.price} ${data.price?.currency || 'PLN'}`);
      console.log(`     CreatedAt: ${data.createdAt}`);
    });
    
    // Check ProductCores
    console.log('\n=== PRODUCT CORES ===\n');
    const productsSnap = await db.collection('product_cores').count().get();
    console.log(`📊 Total product_cores: ${productsSnap.data().count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

checkDeals();
