const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp();
const db = getFirestore();

async function run() {
  const importSettings = await db.collection('config').doc('importSettings').get();
  console.log('--- config/importSettings ---');
  console.log(JSON.stringify(importSettings.data(), null, 2));

  const autopilotSettings = await db.collection('admin_meta').doc('aliexpress-autopilot-settings').get();
  console.log('--- admin_meta/aliexpress-autopilot-settings ---');
  console.log(JSON.stringify(autopilotSettings.data(), null, 2));
}
run().catch(console.error);
