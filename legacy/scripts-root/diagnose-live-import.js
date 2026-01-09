/**
 * Comprehensive live import diagnostics
 * Checks: job status, logs, stage flow, database writes
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function diagnoseImport() {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   LIVE IMPORT DIAGNOSTICS - FULL SCAN  ║');
    console.log('╚════════════════════════════════════════╝\n');

    // === PART 1: Check recent jobs ===
    console.log('📋 Part 1: Recent Import Jobs\n');
    
    const jobsSnap = await db.collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (jobsSnap.empty) {
      console.log('❌ NO IMPORT JOBS FOUND\n');
      process.exit(1);
    }

    console.log(`Found ${jobsSnap.size} recent jobs:\n`);
    
    const jobs = [];
    jobsSnap.forEach(doc => {
      const data = doc.data();
      jobs.push({ id: doc.id, data });
      
      console.log(`  ID: ${doc.id.substring(0, 12)}...`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Type: ${data.importerType || data.type}`);
      console.log(`  Progress: ${data.currentBatchIndex || 0}/${data.batches?.length || 0}`);
      console.log(`  Created: ${new Date(data.createdAt?.toDate?.() || data.createdAt).toLocaleString()}`);
      console.log('');
    });

    // === PART 2: Deep dive into most recent job ===
    console.log('🔍 Part 2: Detailed Analysis of Most Recent Job\n');
    
    const mostRecentJob = jobs[0];
    const jobId = mostRecentJob.id;
    const jobData = mostRecentJob.data;

    console.log(`Job ID: ${jobId}`);
    console.log(`Status: ${jobData.status}`);
    console.log(`Batches: ${jobData.batches?.length || 0}`);
    console.log(`Current Index: ${jobData.currentBatchIndex || 0}`);
    console.log('');

    // === PART 3: Check logs for pipeline issues ===
    console.log('📊 Part 3: Pipeline Stage Analysis\n');

    const logs = jobData.logs || [];
    
    if (logs.length === 0) {
      console.log('⚠️ NO LOGS! Job was created but no batches processed yet.\n');
    } else {
      console.log(`Total batches processed: ${logs.length}\n`);
      
      // Analyze first 3 logs
      const sampleLogs = logs.slice(0, 3);
      let totalFetched = 0;
      let totalDeduplicated = 0;
      let totalEnriched = 0;
      let totalTranslated = 0;
      let totalSaved = 0;
      let successfulBatches = 0;
      let failedBatches = 0;

      sampleLogs.forEach((log, idx) => {
        console.log(`  Batch ${log.batchIndex}: ${log.subcategory}`);
        console.log(`    Status: ${log.status}`);
        console.log(`    Stages: fetch=${log.stages.fetched} → dedup=${log.stages.deduplicated} → enrich=${log.stages.enriched} → trans=${log.stages.translated} → save=${log.stages.saved}`);
        console.log(`    Items: added=${log.itemsAdded}, updated=${log.itemsUpdated}, skipped=${log.itemsSkipped}`);
        console.log(`    Time: ${log.timeMs}ms\n`);

        totalFetched += log.stages.fetched;
        totalDeduplicated += log.stages.deduplicated;
        totalEnriched += log.stages.enriched;
        totalTranslated += log.stages.translated;
        totalSaved += log.stages.saved;
        
        if (log.status === 'success') successfulBatches++;
        else failedBatches++;
      });

      console.log('📈 Summary of first 3 batches:');
      console.log(`  Fetched: ${totalFetched}`);
      console.log(`  Deduplicated: ${totalDeduplicated}`);
      console.log(`  Enriched: ${totalEnriched}`);
      console.log(`  Translated: ${totalTranslated}`);
      console.log(`  Saved: ${totalSaved}`);
      console.log(`  Successful: ${successfulBatches}, Failed: ${failedBatches}\n`);

      // === DIAGNOSIS ===
      console.log('🔧 DIAGNOSIS:\n');
      
      if (totalFetched === 0) {
        console.log('❌ CRITICAL: stageFetch returned 0 products');
        console.log('   Causes: AliExpress API not responding, network error, or keywords wrong\n');
      } else if (totalDeduplicated === 0 && totalFetched > 0) {
        console.log('❌ CRITICAL: stageDedupe filtered out ALL products');
        console.log('   This might be the fix issue - check if code was deployed\n');
      } else if (totalEnriched === 0 && totalDeduplicated > 0) {
        console.log('❌ CRITICAL: stageEnrich failed or returned empty');
        console.log('   Check AI/Genkit errors in logs\n');
      } else if (totalSaved === 0 && totalEnriched > 0) {
        console.log('❌ CRITICAL: stageSave not writing to Firestore');
        console.log('   Check Firestore write permissions and collection name\n');
      } else if (totalSaved > 0) {
        console.log('✅ SUCCESS: Products ARE being saved to database!\n');
      }
    }

    // === PART 4: Check actual products in database ===
    console.log('💾 Part 4: Products in Database\n');

    const recentProducts = await db.collection('products')
      .where('importJobId', '==', jobId)
      .limit(5)
      .get();

    if (recentProducts.size === 0) {
      console.log('❌ NO products found with this importJobId in database');
      console.log('   This confirms stageSave is not writing OR importJobId not being set\n');
    } else {
      console.log(`✅ Found ${recentProducts.size} products with importJobId=${jobId.substring(0, 12)}...\n`);
      recentProducts.forEach(doc => {
        const p = doc.data();
        console.log(`  - ${p.title} (PLN ${p.price})`);
      });
      console.log('');
    }

    // === PART 5: Check database stats ===
    console.log('📊 Part 5: Recent Database Activity\n');

    const allRecentProducts = await db.collection('products')
      .where('createdAt', '>=', new Date(Date.now() - 60 * 60 * 1000)) // last hour
      .limit(10)
      .get();

    console.log(`Products created in last hour: ${allRecentProducts.size}`);
    
    if (allRecentProducts.size > 0) {
      const sources = {};
      allRecentProducts.forEach(doc => {
        const jobId = doc.data().importJobId || 'manual';
        sources[jobId] = (sources[jobId] || 0) + 1;
      });
      console.log('By source:');
      Object.entries(sources).forEach(([source, count]) => {
        console.log(`  ${source.substring(0, 12)}...: ${count} products`);
      });
    }
    console.log('');

    // === PART 6: Code version check ===
    console.log('🔖 Part 6: Deployment Status\n');
    
    try {
      const buildInfo = require('../src/lib/build-info.json');
      console.log(`Current build commit: ${buildInfo.commit}`);
      console.log(`Build time: ${buildInfo.builtAt}`);
    } catch (e) {
      console.log('Could not read build info');
    }

    console.log('\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
    console.error(error);
    process.exit(1);
  }
}

diagnoseImport();
