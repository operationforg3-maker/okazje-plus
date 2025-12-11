const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

(async () => {
  console.log('=== FINAL STATUS CHECK ===\n');
  
  // CORRECT active statuses (cancelled is TERMINAL in old system!)
  const activeNewStatuses = ['queued', 'running', 'paused'];
  const activeOldStatuses = ['queued', 'running', 'paused', 'pending'];
  
  console.log('Active statuses:');
  console.log('  NEW: queued, running, paused');
  console.log('  OLD: queued, running, paused, pending');
  console.log('  (cancelled = TERMINAL, not active!)\n');
  
  // Check NEW
  const newSnap = await db.collection('import_jobs').get();
  const activeNew = newSnap.docs.filter(doc => activeNewStatuses.includes(doc.data().status));
  
  console.log(`NEW system (import_jobs): ${activeNew.length} active`);
  
  // Check OLD
  const oldSnap = await db.collection('importJobs').get();
  const activeOld = oldSnap.docs.filter(doc => activeOldStatuses.includes(doc.data().status));
  
  console.log(`OLD system (importJobs): ${activeOld.length} active`);
  
  console.log(`\n🎯 TOTAL ACTIVE: ${activeNew.length + activeOld.length}`);
  
  if (activeNew.length + activeOld.length === 0) {
    console.log('\n✅ WSZYSTKIE PROCESY ZATRZYMANE!');
    console.log('Cancelled jobs to są już zakończone joby (terminal status).');
  } else {
    console.log('\n⚠️  NIEZABITE PROCESY:');
    [...activeNew, ...activeOld].forEach(doc => {
      const data = doc.data();
      console.log(`  ${doc.id.slice(0, 8)}... | ${data.status}`);
    });
  }
  
  // Show breakdown
  console.log('\n━━━ Status Breakdown ━━━');
  
  const newByStatus = {};
  newSnap.docs.forEach(doc => {
    const s = doc.data().status;
    newByStatus[s] = (newByStatus[s] || 0) + 1;
  });
  console.log('\nNEW system:');
  Object.entries(newByStatus).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
  
  const oldByStatus = {};
  oldSnap.docs.forEach(doc => {
    const s = doc.data().status;
    oldByStatus[s] = (oldByStatus[s] || 0) + 1;
  });
  console.log('\nOLD system:');
  Object.entries(oldByStatus).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
  
  process.exit(0);
})();
