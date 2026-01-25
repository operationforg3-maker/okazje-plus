
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };

if (getApps().length === 0) { 
  if (!process.env.FIREBASE_PROJECT_ID) {
    process.env.FIREBASE_PROJECT_ID = serviceAccount.project_id;
  }
  initializeApp({
    credential: cert(serviceAccount as any)
  });
}

const db = getFirestore();

async function checkProducts() {
  const ids = ['EDF4qMoK3L8lpwqDq9Mt', 'DHQyJhtv8dgWuMf5AYin'];
  
  console.log('Checking specific products...');
  for (const id of ids) {
    const doc = await db.collection('product_cores').doc(id).get();
    if (!doc.exists) {
      console.log(`Product ${id} not found`);
      continue;
    }
    const data = doc.data() as any;
    console.log(`\nProduct [${id}]`);
    console.log(`Title: ${typeof data.title === 'string' ? data.title : data.title?.pl}`);
    console.log(`Desc PL len: ${data.description?.pl?.length || 0}`);
    console.log(`FullDesc PL len: ${data.fullDescription?.pl?.length || 0}`);
    console.log(`Status: ${data.status}`);
    console.log(`Updated: ${data.updatedAt}`);
  }
}

checkProducts().catch(console.error);
