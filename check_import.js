const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus'
});

const db = admin.firestore();

async function verify() {
  console.log('=== JOB STATUS ===');
  const jobDoc = await db.collection('import_jobs').doc('RlCb3td6ombU4EPk1Soz').get();
  
  if (jobDoc.exists) {
    const jobData = jobDoc.data();
    console.log('Job ID:', jobDoc.id);
    console.log('Status:', jobData.status);
    console.log('Total Batches:', jobData.totalBatches);
    console.log('Stats:', jobData.stats);
  } else {
    console.log('Job not found');
  }
  
  console.log('\n=== RECENT PRODUCTS (DRAFT) ===');
  const productsSnapshot = await db.collection('products')
    .where('status', '==', 'draft')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  console.log('Total products found:', productsSnapshot.size);
  
  let withImages = 0;
  let withoutImages = 0;
  
  productsSnapshot.forEach(doc => {
    const data = doc.data();
    const hasImage = data.image && data.image.startsWith('http');
    if (hasImage) {
      withImages++;
      console.log(`✅ [${doc.id}] ${data.name?.substring(0, 40) || 'N/A'} | Price: ${data.price}`);
    } else {
      withoutImages++;
      console.log(`❌ [${doc.id}] ${data.name?.substring(0, 40) || 'N/A'} | NO IMAGE`);
    }
  });
  
  console.log(`\n📊 Result: ${withImages} with images ✅ | ${withoutImages} without ❌`);
  
  admin.app().delete();
  process.exit(0);
}

verify().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
