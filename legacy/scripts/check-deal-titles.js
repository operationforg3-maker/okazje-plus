const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkTitleStructure() {
  const dealsSnapshot = await db.collection('deals')
    .limit(20)
    .get();

  console.log('📊 Struktura title w Dealach:');
  console.log('=============================\n');

  const titleTypes = {};
  
  dealsSnapshot.docs.forEach(doc => {
    const deal = doc.data();
    const titleType = typeof deal.title;
    
    if (!titleTypes[titleType]) {
      titleTypes[titleType] = [];
    }
    
    titleTypes[titleType].push({
      id: doc.id,
      title: deal.title,
      source: deal.source,
    });
  });

  Object.keys(titleTypes).forEach(type => {
    const items = titleTypes[type];
    console.log(`🔹 Type: ${type} (Count: ${items.length})`);
    items.slice(0, 2).forEach((item, idx) => {
      if (typeof item.title === 'string') {
        console.log(`   [${idx + 1}] "${item.title.substring(0, 60)}..." (source: ${item.source})`);
      } else {
        console.log(`   [${idx + 1}] ${JSON.stringify(item.title).substring(0, 80)} (source: ${item.source})`);
      }
    });
    console.log('');
  });

  process.exit(0);
}

checkTitleStructure().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
