import { adminDb } from '../src/lib/firebase-admin';

async function listJobs() {
  console.log('Listing active harvester jobs in Firestore...');
  try {
    const snapshot = await adminDb.collection('harvester_jobs').where('status', '==', 'running').get();
    if (snapshot.empty) {
      console.log('No running jobs found.');
      return;
    }
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`- ID: ${doc.id}`);
      console.log(`  Query: ${data.query}`);
      console.log(`  Source: ${data.source}`);
      console.log(`  StartedAt: ${data.startedAt}`);
      console.log(`  MaxResults: ${data.maxResults}`);
      console.log(`  ProductsFound: ${data.productsFound}`);
      console.log(`  ProductsCreated: ${data.productsCreated}`);
      console.log(`  DealsCreated: ${data.dealsCreated}`);
      console.log(`  Logs count: ${data.logs?.length || 0}`);
      if (data.logs && data.logs.length > 0) {
        console.log(`  Last log: [${data.logs[data.logs.length - 1].level}] ${data.logs[data.logs.length - 1].message}`);
      }
      console.log('-------------------------------');
    });
  } catch (err) {
    console.error('Error querying Firestore:', err);
  }
}

listJobs();
