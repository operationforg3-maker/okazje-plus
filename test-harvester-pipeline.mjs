import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));
initializeApp({ credential: cert(key) });
const db = getFirestore();

async function testHarvesterPipeline() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 HARVESTER → MODERATION PIPELINE TEST');
  console.log('='.repeat(60) + '\n');

  try {
    // 1. Check moderationQueue status
    console.log('📊 1. Checking moderationQueue...\n');
    const queueSnap = await db.collection('moderationQueue').get();
    console.log(`   Total items in queue: ${queueSnap.size}`);
    
    if (queueSnap.size > 0) {
      console.log('\n   📋 Sample queue items (first 5):');
      queueSnap.docs.slice(0, 5).forEach((doc, i) => {
        const item = doc.data();
        console.log(`   ${i + 1}. ID: ${doc.id}`);
        console.log(`      Type: ${item.itemType}`);
        console.log(`      Status: ${item.status}`);
        console.log(`      Priority: ${item.priority}`);
        console.log(`      Source: ${item.source}`);
        console.log(`      Submitted: ${item.submittedAt}`);
      });
    }

    // 2. Check deals by status
    console.log('\n\n📊 2. Checking Deals status distribution...\n');
    for (const status of ['draft', 'pending', 'approved', 'rejected']) {
      const count = await db.collection('deals')
        .where('status', '==', status)
        .count()
        .get();
      console.log(`   ${status}: ${count.data().count}`);
    }

    // 3. Check ProductCores
    console.log('\n\n📊 3. Checking ProductCores...\n');
    const productsCount = await db.collection('product_cores')
      .count()
      .get();
    console.log(`   Total product_cores: ${productsCount.data().count}`);

    // 4. Check most recent deals
    console.log('\n\n📋 4. Most recent DRAFT deals (should be from harvester):\n');
    const recentDrafts = await db.collection('deals')
      .where('status', '==', 'draft')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();
    
    if (recentDrafts.size > 0) {
      recentDrafts.forEach((doc, i) => {
        const deal = doc.data();
        console.log(`   ${i + 1}. ${deal.title?.pl || deal.title || 'N/A'}`);
        console.log(`      ID: ${doc.id}`);
        console.log(`      Price: ${deal.price?.amount || deal.price} ${deal.price?.currency || 'PLN'}`);
        console.log(`      Created: ${deal.createdAt}`);
        console.log(`      Source: ${deal.source}`);
      });
    } else {
      console.log('   ⚠️  No draft deals found (harvester hasn\'t run yet or all approved)');
    }

    // 5. Check harvester jobs
    console.log('\n\n📊 5. Recent Harvester Jobs:\n');
    const jobs = await db.collection('harvester_jobs')
      .limit(3)
      .get();
    
    if (jobs.size > 0) {
      jobs.forEach((doc, i) => {
        const job = doc.data();
        console.log(`   ${i + 1}. Job: ${job.id}`);
        console.log(`      Status: ${job.status}`);
        console.log(`      Source: ${job.source}`);
        console.log(`      Products Found: ${job.productsFound}`);
        console.log(`      Products Created: ${job.productsCreated}`);
        console.log(`      Deals Created: ${job.dealsCreated}`);
        console.log(`      Started: ${job.startedAt}`);
        if (job.status !== 'running') {
          console.log(`      Completed: ${job.completedAt}`);
        }
      });
    }

    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ PIPELINE STATUS:\n');
    
    const draftCount = await db.collection('deals')
      .where('status', '==', 'draft')
      .count()
      .get();
    
    const approvedCount = await db.collection('deals')
      .where('status', '==', 'approved')
      .count()
      .get();

    if (draftCount.data().count > 0) {
      console.log(`✅ Draft deals found: ${draftCount.data().count}`);
      console.log('   → Harvester is working!');
      console.log('   → Deals should be in moderationQueue');
      console.log('   → Deal-Refiner should pick them up for enrichment');
    } else {
      console.log(`⚠️  No draft deals (${approvedCount.data().count} approved)`);
      console.log('   → Run harvester to test pipeline');
    }

    if (queueSnap.size > 0) {
      console.log(`\n✅ Moderation Queue populated: ${queueSnap.size} items`);
      console.log('   → Admin can review and approve');
    } else {
      console.log('\n⚠️  Moderation Queue empty');
      console.log('   → Harvester needs to run');
    }

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

testHarvesterPipeline();
