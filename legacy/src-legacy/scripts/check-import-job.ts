#!/usr/bin/env node

/**
 * Check import job status and logs
 * Usage: npx ts-node src/scripts/check-import-job.ts [jobId]
 */

import { adminDb } from '@/lib/firebase-admin';

async function checkImportJob() {
  try {
    // Get the most recent import job
    const jobsSnapshot = await adminDb
      .collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (jobsSnapshot.empty) {
      console.error('❌ No import jobs found');
      process.exit(1);
    }

    for (const doc of jobsSnapshot.docs) {
      const job = doc.data();
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📋 Job ID: ${doc.id}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Type: ${job.type}`);
      console.log(`Importer: ${job.importerType}`);
      console.log(`Status: ${job.status}`);
      console.log(`Created: ${job.createdAt}`);
      console.log(`Progress: ${job.progress?.completed || 0}/${job.progress?.total || 0} batches`);
      
      console.log(`\n📝 LOGS (last 10):`);
      const logs = job.logs || [];
      const recentLogs = logs.slice(-10);
      
      for (const log of recentLogs) {
        const time = new Date(log.timestamp).toLocaleTimeString('pl-PL');
        console.log(`  [${time}] ${log.subcategory || 'N/A'}`);
        console.log(`    Status: ${log.status}`);
        if (log.stages) {
          console.log(`    Stages: Fetch=${log.stages.fetched} → Dedupe=${log.stages.deduplicated} → Enrich=${log.stages.enriched} → Translate=${log.stages.translated} → Save=${log.stages.saved}`);
        }
        if (log.itemsAdded) {
          console.log(`    Created: ${log.itemsAdded}, Updated: ${log.itemsUpdated}, Skipped: ${log.itemsSkipped}`);
        }
        if (log.error) {
          console.log(`    ❌ ERROR: ${log.error}`);
        }
      }

      // Check sample products from this job
      console.log(`\n🛍️ SAMPLE PRODUCTS FROM THIS JOB:`);
      const productsSnapshot = await adminDb
        .collection('products')
        .where('importJobId', '==', doc.id)
        .limit(3)
        .get();

      if (productsSnapshot.empty) {
        console.log('  ⚠️ No products found for this job');
      } else {
        for (const pDoc of productsSnapshot.docs) {
          const p = pDoc.data();
          console.log(`\n  📦 ${p.name?.slice(0, 50) || 'Unknown'}...`);
          console.log(`    Price: ${p.price?.amount} ${p.price?.currency} ✓ ${p.price?.amount ? '✅' : '❌'}`);
          console.log(`    Image: ${p.image?.slice(0, 50) || 'MISSING'} ${p.image ? '✓' : '❌'}`);
          console.log(`    Category: ${p.mainCategorySlug}/${p.subCategorySlug}`);
          console.log(`    Source: ${p.metadata?.source}`);
          console.log(`    Link: ${p.affiliateUrl?.slice(0, 50) || 'MISSING'}...`);
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkImportJob();
