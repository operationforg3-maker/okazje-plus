const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus'
});

const db = admin.firestore();

async function verify() {
  console.log('=== CHECKING PRODUCTS ===\n');
  
  // Check if ANY products were created in last 30 mins
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  console.log(`Looking for products created after ${thirtyMinsAgo}\n`);
  
  const productsSnapshot = await db.collection('products')
    .where('status', '==', 'approved')
    .where('createdAt', '>', thirtyMinsAgo)
    .get();
    
  console.log(`Found ${productsSnapshot.size} approved products (created >= 30 mins ago)`);
  
  productsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`✅ [${doc.id}] "${data.name?.substring(0, 50)}" | Image: ${data.image ? 'YES' : 'NO'}`);
  });
  
  // Also check draft
  const draftSnapshot = await db.collection('products')
    .where('status', '==', 'draft')
    .where('createdAt', '>', thirtyMinsAgo)
    .get();
    
  console.log(`\nFound ${draftSnapshot.size} draft products (created >= 30 mins ago)`);
  
  draftSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`📋 [${doc.id}] "${data.name?.substring(0, 50)}" | Image: ${data.image ? 'YES' : 'NO'}`);
  });
  
  admin.app().delete();
  process.exit(0);
}

verify().catch(err => { console.error(err.message); process.exit(1); });
