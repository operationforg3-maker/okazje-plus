/**
 * Test actual dedupe logic on LIVE by analyzing product data
 * Fetch fresh product batch and trace through dedupe logic
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testLiveDedupeLogic() {
  try {
    console.log('\n=== Testing LIVE Dedupe Logic ===\n');

    // Get most recent failed job
    const jobSnap = await db.collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (jobSnap.empty) {
      console.log('No jobs found');
      process.exit(1);
    }

    const jobId = jobSnap.docs[0].id;
    const jobData = jobSnap.docs[0].data();

    console.log(`Checking job: ${jobId}`);
    console.log(`Status: ${jobData.status}`);
    console.log(`Logs: ${jobData.logs?.length || 0}\n`);

    if (!jobData.logs || jobData.logs.length === 0) {
      console.log('No logs to analyze');
      process.exit(1);
    }

    // Get first batch log
    const firstLog = jobData.logs[0];
    console.log(`First batch: ${firstLog.subcategory}`);
    console.log(`Fetched: ${firstLog.stages.fetched}`);
    console.log(`Deduplicated: ${firstLog.stages.deduplicated}`);
    console.log('');

    // This tells us:
    if (firstLog.stages.fetched > 0 && firstLog.stages.deduplicated === 0) {
      console.log('❌ DIAGNOSIS: Dedupe filters ALL products (fetched > 0, dedup = 0)');
      console.log('');
      console.log('This means:');
      console.log('  1. stageDedupe IS being called');
      console.log('  2. But filter logic is still rejecting all products');
      console.log('  3. FIX WAS NOT DEPLOYED to production\n');

      console.log('Solution:');
      console.log('  1. Rebuild App Hosting explicitly');
      console.log('  2. Or deploy Cloud Functions directly\n');
      
      // Let's check the actual code by looking at error logs
      console.log('Looking for error details in job data...\n');
      
      // Try to find if there are any error logs in job
      if (jobData.errorLogs && jobData.errorLogs.length > 0) {
        console.log('Error logs found:');
        jobData.errorLogs.slice(0, 3).forEach((err, idx) => {
          console.log(`  ${idx + 1}. ${err.message}`);
        });
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testLiveDedupeLogic();
