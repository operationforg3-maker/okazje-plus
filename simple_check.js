const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'okazje-plus' });
const db = admin.firestore();

async function check() {
  console.log('Checking products (no date filter):\n');
  
  const snap = await db.collection('products').limit(20).get();
  console.log(`Total docs in collection: ~${snap.size} (limited to 20 shown)`);
  
  let withImages = 0;
  snap.forEach(doc => {
    const d = doc.data();
    if (d.image && d.image.startsWith('http')) withImages++;
  });
  
  console.log(`\n${withImages}/${snap.size} products have valid images`);
  
  admin.app().delete();
  process.exit(0);
}

check().catch(err => { console.error(err.message); process.exit(1); });
