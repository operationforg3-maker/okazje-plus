const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp();
const db = getFirestore();
async function run() {
  const snapshot = await db.collection('importJobs').where('status', 'in', ['pending', 'processing', 'running']).get();
  console.log('Active importJobs:', snapshot.size);
  const sysJobs = await db.collection('jobs').where('status', 'in', ['pending', 'processing']).get();
  console.log('Active system jobs:', sysJobs.size);
}
run().catch(console.error);
