const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function checkCategoryDoc() {
  const doc = await db.collection('categories').doc('automotive').get();
  
  if (!doc.exists) {
    console.log('Category document not found');
    process.exit(1);
  }

  console.log('=== CATEGORY DOCUMENT STRUCTURE ===\n');
  console.log(JSON.stringify(doc.data(), null, 2));
  process.exit(0);
}

checkCategoryDoc().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
