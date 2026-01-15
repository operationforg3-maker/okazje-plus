const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function checkAllCategories() {
  const snapshot = await db.collection('categories').get();
  
  console.log(`=== ALL CATEGORIES IN FIRESTORE (${snapshot.size} total) ===\n`);
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`�� ${doc.id}`);
    console.log(`   name (pl): ${data.name || 'N/A'}`);
    if (data.translations?.en?.name) console.log(`   name (en): ${data.translations.en.name}`);
    if (data.translations?.de?.name) console.log(`   name (de): ${data.translations.de.name}`);
    console.log(`   Has subcategories collection: ${data.hasSubcategories ? 'YES' : 'NO'}`);
    console.log();
  });

  process.exit(0);
}

checkAllCategories().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
