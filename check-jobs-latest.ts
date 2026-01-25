
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };

if (!process.env.FIREBASE_PROJECT_ID) {
  // Mock env for initialization if needed, though serviceAccount usually suffices for admin
  process.env.FIREBASE_PROJECT_ID = serviceAccount.project_id;
}

const app = initializeApp({
  credential: cert(serviceAccount as any)
});

const db = getFirestore(app);

async function checkLatestJobs() {
  console.log('Checking 5 latest import_jobs...');
  const snapshot = await db.collection('import_jobs')
    .orderBy('startedAt', 'desc')
    .limit(5)
    .get();

  if (snapshot.empty) {
    console.log('No jobs found.');
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\nJob [${doc.id}]`);
    console.log(`Status: ${data.status}`);
    console.log(`Type: ${data.type}`);
    console.log(`Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
    console.log(`Progress:`, data.progress);
    console.log(`Error:`, data.error || 'None');
    console.log(`Items: ${data.items ? data.items.length : 0}`);
  });
}

checkLatestJobs().catch(console.error);
