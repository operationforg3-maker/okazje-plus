const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const db = admin.firestore();

async function checkLatestJob() {
  console.log('Fetching latest harvester job...');
  const snapshot = await db.collection('harvester_jobs')
    .orderBy('startedAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('No jobs found.');
    return;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  
  console.log('=== LATEST JOB DATA ===');
  console.log('ID:', doc.id);
  console.log('Query:', data.query);
  console.log('Total Categories:', data.totalCategories);
  console.log('Processed Categories Length:', data.processedCategories?.length);
  console.log('Current Category:', data.currentCategory);
  console.log('Full Object Keys:', Object.keys(data));
}

checkLatestJob().catch(console.error);
