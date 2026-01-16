import admin from 'firebase-admin';
import fs from 'fs';

const serviceKey = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceKey) });
const db = admin.firestore();

async function check() {
  // Check deals without categories
  const deals = await db.collection('deals').limit(50).get();
  
  console.log(`\nTotal deals in sample: ${deals.size}`);
  
  let withoutCat = 0;
  let withCat = 0;
  
  deals.docs.forEach(doc => {
    const data = doc.data();
    if (!data.mainCategorySlug || data.mainCategorySlug === 'uncategorized') {
      withoutCat++;
      console.log('❌ No category:', doc.id, '| title:', data.title?.substring(0, 50));
    } else {
      withCat++;
    }
  });
  
  console.log(`\n✅ With category: ${withCat}`);
  console.log(`❌ Without category: ${withoutCat}`);
  
  process.exit(0);
}

check();
