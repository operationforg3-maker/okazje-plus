import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function checkDetails() {
  console.log('🔍 Detailed import job analysis...\n');

  try {
    const jobsSnapshot = await db.collection('import_jobs')
      .where('status', '==', 'running')
      .limit(3)
      .get();

    console.log(`Found ${jobsSnapshot.size} running jobs\n`);

    for (const doc of jobsSnapshot.docs) {
      const data = doc.data();
      console.log(`\n📌 JOB: ${doc.id}`);
      console.log(`   Importer: ${data.importerType}`);
      console.log(`   Progress: ${data.progress?.completed}/${data.progress?.total} batches`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Last Updated: ${data.updatedAt}`);
      
      if (data.logs && data.logs.length > 0) {
        const lastLog = data.logs[data.logs.length - 1];
        console.log(`\n   📝 Latest Log:`);
        if (typeof lastLog === 'object') {
          console.log(`      ${JSON.stringify(lastLog, null, 2).split('\n').slice(0, 8).join('\n      ')}`);
        }
      }

      // Check if there are any products created by this job
      const productsSnapshot = await db.collection('products')
        .where('importJobId', '==', doc.id)
        .limit(3)
        .get();

      console.log(`\n   Products created by this job: ${productsSnapshot.size}`);
      if (productsSnapshot.size > 0) {
        productsSnapshot.docs.forEach(p => {
          const pdata = p.data();
          console.log(`     - ${pdata.name?.substring(0, 50)}`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkDetails();
