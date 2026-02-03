/**
 * Test Harvester Pipeline with Convertiser
 * Simulates production harvester flow:
 * 1. Create ProductCore + Deal
 * 2. Register in moderationQueue
 * 3. Deal-Refiner picks up draft deal
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found!');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'okazje-plus',
});

const db = getFirestore(app);

async function testHarvesterPipeline() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 HARVESTER PIPELINE TEST (Convertiser Simulation)');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Check moderationQueue before
    console.log('📊 Step 1: Checking moderationQueue state BEFORE...');
    
    // List first 5 items
    const queueSnapshot = await db.collection('moderationQueue').limit(5).get();
    console.log(`   Items in moderationQueue: ${queueSnapshot.size}\n`);

    // 2. Check draft deals
    console.log('📊 Step 2: Checking draft deals...');
    const draftSnapshot = await db.collection('deals')
      .where('status', '==', 'draft')
      .limit(10)
      .get();
    console.log(`   Draft deals found: ${draftSnapshot.size}\n`);

    if (draftSnapshot.size > 0) {
      console.log('   📋 Draft deals:');
      draftSnapshot.docs.forEach((doc) => {
        const data = doc.data() as any;
        console.log(`   - ${data.title || 'Unknown'} (${doc.id})`);
        console.log(`     Source: ${data.source}, Status: ${data.status}`);
      });
      console.log();
    }

    // 3. Check approved deals (old data)
    console.log('📊 Step 3: Checking approved deals (from before fix)...');
    const approvedSnapshot = await db.collection('deals')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    console.log(`   Approved deals found: ${approvedSnapshot.size}`);
    
    if (approvedSnapshot.size > 0) {
      console.log('   (These were created with old harvester, not yet in moderationQueue)\n');
    }

    // 4. Check for registration logic
    console.log('📝 Step 4: Verifying harvester registration code...');
    const harvesterPath = 'src/lib/automation/harvester.ts';
    if (fs.existsSync(harvesterPath)) {
      const harvesterCode = fs.readFileSync(harvesterPath, 'utf-8');
      
      if (harvesterCode.includes('addToModerationQueue')) {
        console.log('   ✅ addToModerationQueue() import found');
      } else {
        console.log('   ❌ addToModerationQueue() import NOT found!');
      }
      
      if (harvesterCode.includes('await addToModerationQueue(dealId')) {
        const matches = harvesterCode.match(/await addToModerationQueue/g) || [];
        console.log(`   ✅ ${matches.length}x addToModerationQueue() calls found\n`);
      } else {
        console.log('   ❌ No addToModerationQueue() calls found!\n');
      }
    }

    // 5. Check Deal-Refiner status filter
    console.log('📝 Step 5: Verifying Deal-Refiner status filter...');
    const refinerPath = 'src/lib/automation/deal-refiner.ts';
    if (fs.existsSync(refinerPath)) {
      const refinerCode = fs.readFileSync(refinerPath, 'utf-8');
      
      if (refinerCode.includes("'draft'")) {
        console.log("   ✅ Deal-Refiner searches for status='draft'");
      } else if (refinerCode.includes("'approved'")) {
        console.log("   ❌ Deal-Refiner still searches for status='approved'!");
      }
    }
    console.log();

    // 6. Summary
    console.log('='.repeat(70));
    console.log('📋 PIPELINE STATUS:\n');
    
    const draftCount = draftSnapshot.size;
    const queueItemCount = queueSnapshot.size;
    
    if (draftCount === 0 && queueItemCount === 0) {
      console.log('   ⚠️  No draft deals or moderationQueue items yet');
      console.log('   → Ready for test harvester run!\n');
    } else if (draftCount > 0 && queueItemCount > 0) {
      console.log('   ✅ Pipeline is working!');
      console.log(`   → ${draftCount} draft deals in system`);
      console.log(`   → ${queueItemCount} items in moderationQueue\n`);
    } else {
      console.log('   ⚠️  State mismatch:');
      console.log(`   → Draft deals: ${draftCount}`);
      console.log(`   → Queue items: ${queueItemCount}\n`);
    }

    console.log('🚀 NEXT STEPS:');
    console.log('   1. Set CONVERTISER_API_TOKEN: export CONVERTISER_API_TOKEN="..."');
    console.log('   2. Run: npx tsx test-convertiser.ts');
    console.log('   3. Run direct harvester: npx tsx test-harvester-direct.ts');
    console.log('   4. Or use admin API: npm run dev (then call /api/admin/harvester/start)\n');
    console.log('='.repeat(70) + '\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testHarvesterPipeline();
