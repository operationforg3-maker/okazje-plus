const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function checkSubcategories() {
  const mainCats = await db.collection('categories').get();
  
  console.log('=== CHECKING FOR SUBCATEGORIES ===\n');
  
  let totalSub = 0;
  let totalSubSub = 0;

  for (const mainDoc of mainCats.docs) {
    const subSnapshot = await mainDoc.ref.collection('subcategories').get();
    
    if (!subSnapshot.empty) {
      console.log(`\n📁 ${mainDoc.id}`);
      console.log(`   Subcategories: ${subSnapshot.size}`);
      
      totalSub += subSnapshot.size;

      for (const subDoc of subSnapshot.docs.slice(0, 2)) {
        console.log(`     ├─ ${subDoc.id}`);
        
        const subSubSnapshot = await subDoc.ref.collection('subcategories').get();
        if (!subSubSnapshot.empty) {
          console.log(`     │  Sub-subcategories: ${subSubSnapshot.size}`);
          totalSubSub += subSubSnapshot.size;
          
          for (const subSubDoc of subSubSnapshot.docs.slice(0, 1)) {
            console.log(`     │  └─ ${subSubDoc.id}`);
          }
        }
      }
    }
  }

  console.log(`\n✅ SUMMARY`);
  console.log(`   Total main categories: ${mainCats.size}`);
  console.log(`   Total sub categories: ${totalSub}`);
  console.log(`   Total sub-sub categories: ${totalSubSub}`);

  process.exit(0);
}

checkSubcategories().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
