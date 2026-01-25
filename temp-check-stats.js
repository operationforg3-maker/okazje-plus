const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const jobs = await db.collection('harvester_jobs').where('status', '==', 'running').limit(1).get();
  if (jobs.empty) return;
  const d = jobs.docs[0].data();
  console.log('Stats:');
  console.log('Found:', d.productsFound);
  console.log('Created:', d.productsCreated);
  console.log('Deals Created:', d.dealsCreated);
  console.log('Duplicates Skipped:', d.duplicatesSkipped);
  console.log('Processed Categories:', d.processedCategories ? d.processedCategories.length : 0);
  console.log('Total Categories:', d.totalCategories);
}
check();
