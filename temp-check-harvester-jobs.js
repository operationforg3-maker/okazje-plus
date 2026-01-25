const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  console.log('Checking recent harvester_jobs...');
  try {
    const jobs = await db.collection('harvester_jobs').orderBy('startedAt', 'desc').limit(5).get();
    if (jobs.empty) {
        console.log("No harvester_jobs found. Trying unordered...");
        const jobsUnordered = await db.collection('harvester_jobs').limit(5).get();
         if (jobsUnordered.empty) {
             console.log("Absolutely no harvester_jobs found.");
             return;
         }
         jobsUnordered.forEach(printJob);
         return;
    }
    
    jobs.forEach(printJob);
  } catch(e) {
      console.error(e);
  }
}

function printJob(doc) {
    const d = doc.data();
    const date = d.startedAt ? (typeof d.startedAt === 'string' ? d.startedAt : new Date(d.startedAt).toLocaleString()) : 'Unknown';
    console.log(`\nJob [${doc.id}]`);
    console.log(`Status: ${d.status}`);
    console.log(`Started: ${date}`);
    console.log(`Query: ${(d.query || 'N/A').substring(0, 100)}...`);
    
    // Logs might be in 'logs' array or subcollection
    if (d.status === 'running' || d.status === 'failed') {
        if (d.logs && Array.isArray(d.logs)) {
             console.log('Last 5 logs:');
            d.logs.slice(-5).forEach(l => console.log(`  [${l.timestamp}] ${l.message}`));
        } else {
            console.log('  No logs array in doc.');
        }
        if (d.error) console.log('Error:', d.error);
    }
}

check();
