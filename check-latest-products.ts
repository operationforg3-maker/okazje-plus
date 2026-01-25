
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };

if (!process.env.FIREBASE_PROJECT_ID) {
  process.env.FIREBASE_PROJECT_ID = serviceAccount.project_id;
}

const app = initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore(app);

async function checkLatestProducts() {
  console.log('Checking specific products...');
  const ids = ['EDF4qMoK3L8lpwqDq9Mt', 'DHQyJhtv8dgWuMf5AYin'];
  
  for (const id of ids) {
    const doc = await db.collection('product_cores').doc(id).get();
    if (!doc.exists) {
       // Try fetching latest if specific not found
       continue;
    }
    const data = doc.data();
    console.log(`\nProduct [${doc.id}]`);
    console.log(`Status: ${data.status}`);
    console.log(`Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
    console.log(`Title (PL): ${data.title?.pl || data.title}`);
    console.log(`Description (PL Length): ${data.description?.pl?.length || 0}`);
    console.log(`Quality Score: ${data.qualityScore}`);
  }

  console.log('\nChecking 5 latest product_cores...');
  const snapshot = await db.collection('product_cores')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  if (snapshot.empty) {
    console.log('No products found.');
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\nProduct [${doc.id}]`);
    console.log(`Status: ${data.status}`);
    console.log(`Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
    console.log(`Title (PL): ${data.title?.pl || data.title}`);
    console.log(`Description (PL Length): ${data.description?.pl?.length || 0}`);
    console.log(`Quality Score: ${data.qualityScore}`);
    console.log(`Source: ${data.source}`);
  });
}

checkLatestProducts().catch(console.error);
