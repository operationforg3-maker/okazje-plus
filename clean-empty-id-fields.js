const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanEmptyIdFields() {
  console.log('🔍 Scanning for documents with empty "id" field...\n');
  
  const collections = ['product_cores', 'deals', 'products'];
  let totalFixed = 0;
  
  for (const collectionName of collections) {
    console.log(`\n📦 Checking collection: ${collectionName}`);
    
    try {
      const snapshot = await db.collection(collectionName).get();
      console.log(`   Found ${snapshot.size} documents`);
      
      let fixedInCollection = 0;
      let batch = db.batch();
      let batchCount = 0;
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Check if document has 'id' field that is empty or doesn't match doc.id
        if ('id' in data && (data.id === '' || data.id !== doc.id)) {
          console.log(`   ⚠️  Doc ${doc.id}: id field is "${data.id}" (should be removed)`);
          
          // Remove the 'id' field from document
          batch.update(doc.ref, {
            id: admin.firestore.FieldValue.delete()
          });
          
          fixedInCollection++;
          batchCount++;
          
          // Commit batch every 500 operations (Firestore limit)
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`   💾 Committed batch of ${batchCount} updates`);
            // Create new batch for next operations
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
      
      // Commit remaining updates
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   💾 Committed final batch of ${batchCount} updates`);
      }
      
      console.log(`   ✅ Fixed ${fixedInCollection} documents in ${collectionName}`);
      totalFixed += fixedInCollection;
      
    } catch (err) {
      console.error(`   ❌ Error processing ${collectionName}:`, err.message);
    }
  }
  
  console.log(`\n✨ DONE! Fixed ${totalFixed} documents total.`);
  console.log('\n💡 All documents now rely on docSnap.id instead of data.id field.');
}

// Run the cleanup
cleanEmptyIdFields()
  .then(() => {
    console.log('\n👍 Cleanup completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Cleanup failed:', err);
    process.exit(1);
  });
