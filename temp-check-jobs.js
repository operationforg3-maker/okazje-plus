const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
  console.log('Checking recent jobs...');
  try {
    const jobs = await db.collection('import_jobs').orderBy('startedAt', 'desc').limit(5).get();
    if (jobs.empty) {
        console.log("No jobs found.");
        return;
    }
    
    jobs.forEach(doc => {
        const d = doc.data();
        const date = d.startedAt ? (typeof d.startedAt === 'string' ? d.startedAt : new Date(d.startedAt).toLocaleString()) : 'Unknown';
        console.log(`\nJob [${doc.id}]`);
        console.log(`Status: ${d.status}`);
        console.log(`Started: ${date}`);
        console.log(`Query: ${d.query || 'N/A'}`);
        console.log(`Progress: ${d.progress ? JSON.stringify(d.progress) : 'N/A'}`);
        
        if (d.status === 'running' || d.status === 'failed') {
            console.log('Last 5 logs:');
            if (d.logs && Array.isArray(d.logs)) {
                d.logs.slice(-5).forEach(l => console.log(`  [${new Date(l.timestamp).toLocaleTimeString()}] ${l.message}`));
            } else {
                console.log('  No logs available.');
            }
            if (d.error) {
                console.log('Error:', d.error);
            }
        }
    });
  } catch(e) {
      console.error(e);
  }
}
check();
