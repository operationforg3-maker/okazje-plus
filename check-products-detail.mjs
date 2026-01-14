import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'okazje-plus',
});

const db = admin.firestore();

async function check() {
  // Check statuses
  const stats = { approved: 0, pending_approval: 0, draft: 0, rejected: 0, other: 0 };
  const allRef = db.collection('product_cores');
  const allSnap = await allRef.get();
  
  allSnap.forEach(doc => {
    const status = doc.data().status || 'UNKNOWN';
    if (status in stats) stats[status]++;
    else stats.other++;
  });
  
  console.log('Product Cores by status:');
  console.log(stats);
  
  // Check deals
  const dealStats = { approved: 0, draft: 0, pending: 0, rejected: 0, other: 0 };
  const dealsRef = db.collection('deals');
  const dealsSnap = await dealsRef.get();
  
  dealsSnap.forEach(doc => {
    const status = doc.data().status || 'UNKNOWN';
    if (status in dealStats) dealStats[status]++;
    else dealStats.other++;
  });
  
  console.log('\nDeals by status:');
  console.log(dealStats);
}

check();
