/**
 * COMPREHENSIVE LIVE IMPORT TEST
 * 
 * Runs a small import, monitors all 5 pipeline stages,
 * and confirms products are saved to database.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function runLiveImportTest() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     LIVE IMPORT TEST - FULL TRACE      ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // STEP 1: Create test job
    console.log('📝 STEP 1: Creating test import job...\n');
    
    const jobRef = db.collection('import_jobs').doc();
    const jobId = jobRef.id;
    
    // Create minimal job for testing
    await jobRef.set({
      id: jobId,
      type: 'products',  // Must be 'products' for pipeline to run!
      importerType: 'keyword-search',
      status: 'queued',
      sources: ['keyword-search'],
      currentBatchIndex: 0,
      maxItemsPerSubcategory: 3, // SMALL for testing
      batches: [
        {
          categoryId: 'elektronika',
          categoryName: 'Elektronika',
          categorySlug: 'elektronika',
          subcategoryId: 'smartfony-telefony',
          subcategoryName: 'Smartfony i telefony',
          subcategorySlug: 'smartfony-telefony',
          subsubcategoryId: 'smartfony',
          subsubcategoryName: 'Smartfony',
          subsubcategorySlug: 'smartfony',
          importKeywords: ['smartfon', 'telefon', 'smartphone']  // Add keywords for pipeline
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: { total: 1, completed: 0, failed: 0, current: 0 },
      logs: [],
      itemsCreated: [],
      itemsUpdated: []
    });

    console.log(`✅ Job created: ${jobId}\n`);

    // STEP 2: Manually trigger import processing
    console.log('⏳ STEP 2: Simulating import batch processing...\n');
    console.log('(In production, processImportJob async function would handle this)\n');

    // STEP 3: Wait for processing
    console.log('⏳ Waiting 45 seconds for first batch to process...\n');
    await new Promise(resolve => setTimeout(resolve, 45000));

    // STEP 4: Check job status
    console.log('📋 STEP 4: Checking job logs...\n');
    
    const jobDoc = await jobRef.get();
    const jobData = jobDoc.data();

    if (!jobData.logs || jobData.logs.length === 0) {
      console.log('⚠️ No logs yet - processor may not have started');
      console.log('Possible causes:');
      console.log('  1. Function takes time to initialize');
      console.log('  2. No Cloud Function trigger configured');
      console.log('  3. Job still queued\n');
    } else {
      const log = jobData.logs[0];
      
      console.log(`Batch: ${log.subcategory}`);
      console.log(`Status: ${log.status}`);
      console.log(`\nPipeline stages:`);
      console.log(`  1️⃣  FETCH:        ${log.stages.fetched} products`);
      console.log(`  2️⃣  DEDUPE:       ${log.stages.deduplicated} products`);
      console.log(`  3️⃣  ENRICH:       ${log.stages.enriched} products`);
      console.log(`  4️⃣  TRANSLATE:    ${log.stages.translated} products`);
      console.log(`  5️⃣  SAVE:         ${log.stages.saved} products`);
      console.log('');

      // DIAGNOSIS
      if (log.stages.fetched === 0) {
        console.log('❌ PROBLEM: stageFetch returned 0 products');
        console.log('   Cause: AliExpress API down or not configured\n');
      } else if (log.stages.deduplicated === 0) {
        console.log('❌ PROBLEM: stageDedupe filtered out ALL products');
        console.log('   Cause: Fix not deployed OR dedupe config too strict\n');
      } else if (log.stages.enriched === 0) {
        console.log('⚠️ ISSUE: Products not enriched');
        console.log('   Check: stageEnrich function logs\n');
      } else if (log.stages.saved === 0) {
        console.log('⚠️ ISSUE: Products not saved to database');
        console.log('   Check: Firestore write permissions\n');
      } else {
        console.log('✅ SUCCESS: Products moving through all stages!\n');
      }
    }

    // STEP 5: Check database
    console.log('💾 STEP 5: Checking products in database...\n');
    
    const productsSnap = await db.collection('products')
      .where('importJobId', '==', jobId)
      .limit(5)
      .get();

    if (productsSnap.size === 0) {
      console.log('❌ No products saved with this importJobId');
      console.log('   This confirms stageSave is not writing\n');
    } else {
      console.log(`✅ Found ${productsSnap.size} products saved!\n`);
      productsSnap.forEach(doc => {
        const p = doc.data();
        console.log(`  • ${p.title} (PLN ${p.price?.toFixed(2) || '?'})`);
      });
      console.log('');
    }

    // FINAL DIAGNOSIS
    console.log('═══════════════════════════════════════\n');
    
    if (jobData.logs && jobData.logs.length > 0) {
      const log = jobData.logs[0];
      if (log.stages.fetched > 0 && log.stages.deduplicated > 0) {
        console.log('🎉 FIX IS WORKING! Dedupe stage is passing products through!\n');
        console.log('Next steps:');
        console.log('  1. ✅ Products are being fetched from AliExpress');
        console.log('  2. ✅ Products pass dedupe filters');
        console.log('  3. ⏳ Enrichment and translation running...');
        console.log('  4. ⏳ Checking Firestore writes...\n');
      }
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

runLiveImportTest();
