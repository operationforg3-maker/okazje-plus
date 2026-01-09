import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus-dev'
});

const db = admin.firestore(app);

// Set timeout to 5 seconds
const timeout = setTimeout(() => {
  console.log('⏱️ Firestore query timeout - connection issue?');
  process.exit(1);
}, 5000);

try {
  const importJobs = await db.collection('import_jobs').limit(1).get();
  clearTimeout(timeout);
  console.log(`Found ${importJobs.size} import jobs`);
  
  if (importJobs.size > 0) {
    const first = importJobs.docs[0];
    console.log(`\nLatest job: ${first.id}`);
    console.log(JSON.stringify(first.data(), null, 2));
  }
} catch (e) {
  clearTimeout(timeout);
  console.error('Error:', e.message);
}
