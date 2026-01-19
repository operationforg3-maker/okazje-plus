import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const jobId = 'WrY9cKzzDyboqH73Cq6a';
const job = await db.collection('import_jobs').doc(jobId).get();

if (job.exists) {
  const data = job.data();
  console.log(`\n📊 JOB: ${jobId}`);
  console.log(`Status: ${data.status}`);
  console.log(`Progress: ${data.progress.completed}/${data.progress.total}`);
  console.log(`Total logs: ${data.logs?.length || 0}`);
  
  // Find saved count
  const logs = data.logs || [];
  let totalSaved = 0;
  let totalSkipped = 0;
  logs.forEach(log => {
    if (log.stages?.saved) totalSaved += log.stages.saved;
    if (log.itemsSkipped) totalSkipped += log.itemsSkipped;
  });
  
  console.log(`\n🎯 RESULTS:`);
  console.log(`  Products SAVED: ${totalSaved} ✅`);
  console.log(`  Products SKIPPED: ${totalSkipped}`);
}

// Check Firestore products
const products = await db.collection('products').limit(10).get();
console.log(`\n📦 Products in Firestore: ${products.size}`);

if (products.size > 0) {
  console.log(`\n🎉 SUCCESS! Sample products:`);
  products.docs.slice(0, 3).forEach((doc, i) => {
    const p = doc.data();
    console.log(`\n  ${i+1}. ${p.title?.pl?.slice(0, 60) || p.title?.en?.slice(0, 60)}`);
    console.log(`     Cena: ${p.price?.amount} ${p.price?.currency}`);
    console.log(`     Kategoria: ${p.categoryName}/${p.subcategoryName}`);
  });
}
