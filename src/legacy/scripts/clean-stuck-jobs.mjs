// clean-stuck-jobs.mjs - Clear stuck import jobs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function cleanJobs() {
  console.log('🧹 Cleaning stuck import jobs...\n');

  try {
    // Get all running jobs
    const runningJobsSnapshot = await db.collection('import_jobs')
      .where('status', '==', 'running')
      .get();

    console.log(`Found ${runningJobsSnapshot.size} stuck jobs with status "running"\n`);

    if (runningJobsSnapshot.size === 0) {
      console.log('✅ No stuck jobs to clean');
      process.exit(0);
    }

    const batch = db.batch();
    const now = new Date().toISOString();

    runningJobsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Marking job ${doc.id} as failed (was stuck since ${data.createdAt})`);
      
      batch.update(doc.ref, {
        status: 'failed',
        error: 'Job was stuck in running state - cleaned up manually',
        completedAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();
    console.log(`\n✅ Successfully marked ${runningJobsSnapshot.size} jobs as failed`);

  } catch (error) {
    console.error('❌ Error cleaning jobs:', error);
  }

  process.exit(0);
}

cleanJobs();
