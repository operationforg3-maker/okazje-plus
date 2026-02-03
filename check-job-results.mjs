import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

async function checkCompletedJob() {
  try {
    // Get the most recent completed job (simple query)
    const jobs = await db.collection('harvester_jobs')
      .where('status', '==', 'completed')
      .limit(1)
      .get();
    
    if (jobs.empty) {
      console.log('No completed jobs found');
      return;
    }
    
    const job = jobs.docs[0];
    const data = job.data();
    
    console.log('\n=== COMPLETED JOB ===');
    console.log(`Job ID: ${job.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Source: ${data.source}`);
    console.log(`Products Found: ${data.productsFound}`);
    console.log(`Products Created: ${data.productsCreated}`);
    console.log(`Deals Created: ${data.dealsCreated}`);
    console.log(`Started: ${data.startedAt}`);
    console.log(`Completed: ${data.completedAt}`);
    
    // Show last 3 logs
    console.log('\n📋 Last 5 logs:');
    (data.logs || []).slice(-5).forEach(log => {
      console.log(`  [${log.level.toUpperCase()}] ${log.message}`);
    });
    
    // Check statuses of first 5 deals
    console.log('\n=== SAMPLE DEALS (first 5 from DB) ===');
    const deals = await db.collection('deals').limit(5).get();
    deals.forEach(d => {
      const deal = d.data();
      console.log(`${d.id}: ${deal.title?.pl?.substring(0, 40) || 'N/A'} [${deal.status}] created: ${deal.createdAt}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

checkCompletedJob();
