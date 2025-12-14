const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  console.log('🔍 Checking raw product data...\n');
  
  const products = await db.collection('products')
    .limit(3)
    .get();
  
  for (const doc of products.docs) {
    const p = doc.data();
    console.log(`\n📦 Product: ${p.title?.pl?.substring(0, 50)}`);
    console.log(`   Current image: ${p.image?.substring(0, 70)}`);
    
    // Check if there's metadata about original images
    if (p.metadata?.originalId) {
      console.log(`   Original ID: ${p.metadata.originalId}`);
    }
    
    // Check for image hints
    if (p.imageHint) {
      console.log(`   Image hint: ${p.imageHint}`);
    }
    
    // Check full metadata
    console.log(`   Metadata keys: ${Object.keys(p.metadata || {}).join(', ')}`);
  }
  
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
