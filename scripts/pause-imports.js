const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp();
const db = getFirestore();

async function run() {
  console.log('Zatrzymywanie aktywnych zadań...');
  
  // 1. Oznacz istniejące importJobs jako failed lub anulowane
  const importJobs = await db.collection('importJobs').where('status', 'in', ['pending', 'processing', 'running']).get();
  const batch = db.batch();
  importJobs.forEach(doc => {
    batch.update(doc.ref, { status: 'failed', error: 'Zatrzymane ręcznie przez administratora' });
  });
  console.log(`Zatrzymano ${importJobs.size} zadań typu importJobs.`);

  // 2. Oznacz systemowe jobs (z których korzysta process-jobs)
  const sysJobs = await db.collection('jobs').where('status', 'in', ['pending', 'processing']).get();
  sysJobs.forEach(doc => {
    batch.update(doc.ref, { status: 'failed', error: 'Zatrzymane ręcznie przez administratora' });
  });
  console.log(`Zatrzymano ${sysJobs.size} zadań systemowych.`);

  // 3. Ustaw flagę isPaused w config/importSettings
  const configRef = db.collection('config').doc('importSettings');
  batch.set(configRef, { isPaused: true }, { merge: true });
  console.log('Zaktualizowano konfigurację: isPaused = true');

  await batch.commit();
  console.log('Wszystkie procesy importu zostały zatrzymane.');
}
run().catch(console.error);
