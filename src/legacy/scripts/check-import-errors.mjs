// check-import-errors.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function checkErrors() {
  console.log('🔍 Looking for error messages in import logs...\n');

  try {
    const jobSnapshot = await db.collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (jobSnapshot.empty) {
      console.log('❌ No jobs');
      process.exit(0);
    }

    const jobData = jobSnapshot.docs[0].data();
    console.log(`Job: ${jobSnapshot.docs[0].id}`);
    console.log(`Status: ${jobData.status}`);
    console.log(`Progress: ${JSON.stringify(jobData.progress)}\n`);

    if (!jobData.logs) {
      console.log('No logs');
      process.exit(0);
    }

    const logs = jobData.logs;
    console.log(`Total logs: ${logs.length}\n`);

    // Find error logs
    const errorLogs = logs.filter(l => 
      typeof l === 'object' && (l.error || l.status === 'error' || (l.message && l.message.includes('error')))
    );

    if (errorLogs.length > 0) {
      console.log(`❌ Found ${errorLogs.length} error messages:\n`);
      errorLogs.forEach((log, idx) => {
        console.log(`${idx + 1}. [${log.timestamp}]`);
        if (log.error) console.log(`   Error: ${log.error}`);
        if (log.message) console.log(`   Message: ${log.message}`);
        if (log.batchIndex !== undefined) console.log(`   Batch: ${log.batchIndex}`);
        console.log('');
      });
    } else {
      console.log('✅ No error messages found');
    }

    // Check for Stage 5 (Save) logs
    console.log('\n📊 Stage 5 (Save) logs:\n');
    const saveLogs = logs.filter(l => typeof l === 'object' && (l.message?.includes('Stage 5') || l.message?.includes('Save')));
    if (saveLogs.length > 0) {
      saveLogs.forEach(log => {
        console.log(`[${log.timestamp}] ${log.message}`);
      });
    } else {
      console.log('No Stage 5 logs found');
    }

    // Check for skip reason logs
    console.log('\n⚠️ Skip reason logs:\n');
    const skipLogs = logs.filter(l => typeof l === 'object' && (l.message?.includes('SKIP') || l.message?.includes('skip')));
    if (skipLogs.length > 0) {
      skipLogs.forEach(log => {
        console.log(`[${log.timestamp}] ${log.message}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkErrors();
