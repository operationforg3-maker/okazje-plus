const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  console.log('=== LIVE STATUS CHECK - All Import Jobs ===\n');
  console.log('Timestamp:', new Date().toLocaleString('pl-PL'), '\n');
  
  // Check NEW system (import_jobs)
  console.log('━━━ NEW SYSTEM (import_jobs) ━━━');
  const newSnap = await db.collection('import_jobs').get();
  const newByStatus = {};
  newSnap.docs.forEach(doc => {
    const status = doc.data().status;
    newByStatus[status] = (newByStatus[status] || 0) + 1;
  });
  
  console.log(`Total: ${newSnap.size} jobs`);
  Object.entries(newByStatus).forEach(([status, count]) => {
    const icon = ['queued', 'running', 'paused', 'cancelled'].includes(status) ? '⚠️ ' : '✅';
    console.log(`  ${icon} ${status}: ${count}`);
  });
  
  // Check OLD system (importJobs)
  console.log('\n━━━ OLD SYSTEM (importJobs) ━━━');
  const oldSnap = await db.collection('importJobs').get();
  const oldByStatus = {};
  oldSnap.docs.forEach(doc => {
    const status = doc.data().status;
    oldByStatus[status] = (oldByStatus[status] || 0) + 1;
  });
  
  console.log(`Total: ${oldSnap.size} jobs`);
  Object.entries(oldByStatus).forEach(([status, count]) => {
    const icon = ['queued', 'running', 'paused', 'cancelled', 'pending'].includes(status) ? '⚠️ ' : '✅';
    console.log(`  ${icon} ${status}: ${count}`);
  });
  
  // Calculate ACTIVE jobs
  const activeNewStatuses = ['queued', 'running', 'paused', 'cancelled'];
  const activeOldStatuses = ['queued', 'running', 'paused', 'cancelled', 'pending'];
  
  const activeNew = newSnap.docs.filter(doc => activeNewStatuses.includes(doc.data().status));
  const activeOld = oldSnap.docs.filter(doc => activeOldStatuses.includes(doc.data().status));
  
  console.log('\n━━━ SUMMARY ━━━');
  console.log(`Active in NEW system: ${activeNew.length}`);
  console.log(`Active in OLD system: ${activeOld.length}`);
  console.log(`TOTAL ACTIVE: ${activeNew.length + activeOld.length}`);
  
  if (activeNew.length + activeOld.length > 0) {
    console.log('\n🚨 NIEZABITE PROCESY:');
    
    if (activeNew.length > 0) {
      console.log('\n  NEW system (import_jobs):');
      activeNew.slice(0, 5).forEach(doc => {
        const data = doc.data();
        const date = data.createdAt ? new Date(data.createdAt).toLocaleString('pl-PL') : 'N/A';
        const sources = data.sources ? data.sources.join(', ') : 'N/A';
        console.log(`    ${doc.id.slice(0, 8)}... | ${data.status} | ${date} | ${sources}`);
      });
      if (activeNew.length > 5) console.log(`    ... i ${activeNew.length - 5} więcej`);
    }
    
    if (activeOld.length > 0) {
      console.log('\n  OLD system (importJobs):');
      activeOld.slice(0, 5).forEach(doc => {
        const data = doc.data();
        const date = data.createdAt ? new Date(data.createdAt).toLocaleString('pl-PL') : 'N/A';
        const sources = data.sources ? data.sources.join(', ') : 'N/A';
        console.log(`    ${doc.id.slice(0, 8)}... | ${data.status} | ${date} | ${sources}`);
      });
      if (activeOld.length > 5) console.log(`    ... i ${activeOld.length - 5} więcej`);
    }
  } else {
    console.log('\n✅ WSZYSTKIE PROCESY ZATRZYMANE!');
  }
  
  process.exit(0);
})();
