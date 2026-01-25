const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  const jobs = await db.collection('harvester_jobs').where('status', '==', 'running').limit(1).get();
  if (jobs.empty) {
      console.log('No running jobs.');
      return;
  }
  
  const job = jobs.docs[0];
  const d = job.data();
  console.log(`Checking running job ${job.id}`);
  
  if (d.logs) {
      const errors = d.logs.filter(l => l.message.toLowerCase().includes('error') || l.message.toLowerCase().includes('fail'));
      if (errors.length > 0) {
          console.log('Found errors in logs:');
          errors.forEach(e => console.log(`[${e.timestamp}] ${e.message}`));
      } else {
          console.log('No explicit errors found in logs.');
      }
      
      console.log('Last 3 logs:');
      d.logs.slice(-3).forEach(l => console.log(`[${l.timestamp}] ${l.message}`));
  }
}
check();
