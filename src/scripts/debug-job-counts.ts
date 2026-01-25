
import { adminDb } from '../lib/firebase-admin';

async function checkJobCounts() {
  try {
    const harvesterSnapshot = await adminDb.collection('harvester_jobs').count().get();
    const refinerSnapshot = await adminDb.collection('refiner_jobs').count().get();

    console.log('Harvester Jobs Count:', harvesterSnapshot.data().count);
    console.log('Refiner Jobs Count:', refinerSnapshot.data().count);

    // Also list a few to see status
    const recentHarvester = await adminDb.collection('harvester_jobs')
      .orderBy('startedAt', 'desc')
      .limit(3)
      .get();
    
    console.log('Recent Harvester Jobs:');
    recentHarvester.docs.forEach(d => {
      console.log(`- ID: ${d.id}, Status: ${d.data().status}, Created: ${d.data().startedAt}`);
    });

  } catch (error) {
    console.error('Error checking DB:', error);
  }
}

checkJobCounts();
