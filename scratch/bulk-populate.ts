import 'dotenv/config';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { runProductImportPipeline } from '../src/ai/flows/importerFlow';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// CLI options
const APPLY = process.argv.includes('--apply');
const MODE = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] || 'direct'; // 'direct' or 'queue'
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 9999);
const MAX_PRODUCTS = Number(process.argv.find((arg) => arg.startsWith('--max-products='))?.split('=')[1] || 5);
const BYPASS_REFINEMENT = process.argv.includes('--skip-refinement') || process.argv.includes('--bypass-refinement');
const DEFAULT_DELAY = BYPASS_REFINEMENT ? 1000 : 15000;
const DELAY = Number(process.argv.find((arg) => arg.startsWith('--delay='))?.split('=')[1] || DEFAULT_DELAY);
const START_AT = process.argv.find((arg) => arg.startsWith('--start-at='))?.split('=')[1];

type CategoryNode = {
  name?: string;
  slug: string;
  importKeywords?: string[];
  aliexpressKeywords?: string[];
  aliexpressCategoryIds?: string[];
  subcategories?: CategoryNode[];
  translations?: Record<string, { name?: string; description?: string }>;
};

async function main() {
  // 1. Initialize Firebase Admin
  if (!getApps().length) {
    const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      console.log('🔑 Using local serviceAccountKey.json');
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      console.log('☁️ Using environment credentials');
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'okazje-plus'
      });
    }
  }

  const db = getFirestore();

  // 2. Read category tree JSON
  const treePath = path.resolve(process.cwd(), 'category-tree-seo-extended.json');
  if (!fs.existsSync(treePath)) {
    console.error(`❌ Category tree file not found: ${treePath}`);
    process.exit(1);
  }

  const categoryData = JSON.parse(fs.readFileSync(treePath, 'utf8'));
  const tree = categoryData.tree as CategoryNode[];

  console.log(`📋 Loaded category tree with ${tree.length} main categories.`);

  // 3. Extract leaf category import targets
  const targets: Array<{
    mainSlug: string;
    mainName: string;
    subSlug: string;
    subName: string;
    subSubSlug?: string;
    subSubName?: string;
    keywords: string[];
    aliexpressCategoryIds?: string[];
  }> = [];

  for (const main of tree) {
    const mainName = main.translations?.pl?.name || main.name || main.slug;
    for (const sub of main.subcategories || []) {
      const subName = sub.translations?.pl?.name || sub.name || sub.slug;
      
      const subSubcategories = sub.subcategories || [];
      if (subSubcategories.length > 0) {
        for (const subSub of subSubcategories) {
          const subSubName = subSub.translations?.pl?.name || subSub.name || subSub.slug;
          const keywords = subSub.importKeywords || subSub.aliexpressKeywords || [subSubName];
          
          targets.push({
            mainSlug: main.slug,
            mainName,
            subSlug: sub.slug,
            subName,
            subSubSlug: subSub.slug,
            subSubName,
            keywords,
            aliexpressCategoryIds: subSub.aliexpressCategoryIds,
          });
        }
      } else {
        // No sub-subcategories, use subcategory as leaf
        const keywords = sub.importKeywords || sub.aliexpressKeywords || [subName];
        targets.push({
          mainSlug: main.slug,
          mainName,
          subSlug: sub.slug,
          subName,
          keywords,
          aliexpressCategoryIds: sub.aliexpressCategoryIds,
        });
      }
    }
  }

  console.log(`🎯 Extracted ${targets.length} leaf category import targets.`);

  // Filter start_at if provided
  let startIndex = 0;
  if (START_AT) {
    startIndex = targets.findIndex(t => t.subSubSlug === START_AT || t.subSlug === START_AT);
    if (startIndex === -1) {
      console.error(`❌ Could not find resume starting category: ${START_AT}`);
      process.exit(1);
    }
    console.log(`⏯️ Resuming from index ${startIndex} (${targets[startIndex].subSubSlug || targets[startIndex].subSlug})`);
  }

  const targetsToProcess = targets.slice(startIndex, startIndex + LIMIT);
  console.log(`🚀 Processing ${targetsToProcess.length} categories...`);
  console.log(`Settings: mode=${MODE}, maxProducts=${MAX_PRODUCTS}, delay=${DELAY}ms, apply=${APPLY}\n`);

  if (!APPLY) {
    console.log('🔍 DRY RUN - Printing first 5 target configurations:');
    targetsToProcess.slice(0, 5).forEach((t, i) => {
      console.log(`  ${i + 1}. Path: ${t.mainName} > ${t.subName} ${t.subSubName ? '> ' + t.subSubName : ''}`);
      console.log(`     Slugs: ${t.mainSlug} > ${t.subSlug} ${t.subSubSlug ? '> ' + t.subSubSlug : ''}`);
      console.log(`     Keywords: ${t.keywords.join(', ')}`);
      console.log(`     AliExpress IDs: ${t.aliexpressCategoryIds?.join(', ') || 'none'}\n`);
    });
    console.log(`... and ${targetsToProcess.length - 5} more categories.`);
    console.log('\n💡 Run with --apply to execute the imports.');
    process.exit(0);
  }

  // 4. Run loop
  let successCount = 0;
  let errorCount = 0;

  const harvesterJobId = `bulk-import-${Date.now()}`;
  if (APPLY) {
    const initialHarvesterJob = {
      id: harvesterJobId,
      source: 'aliexpress',
      query: `Bulk Category Import (${targetsToProcess.length} categories)`,
      status: 'running',
      productsFound: 0,
      productsCreated: 0,
      dealsCreated: 0,
      duplicatesSkipped: 0,
      progress: 0,
      startedAt: new Date().toISOString(),
      currentCategory: '',
      totalCategories: targetsToProcess.length,
      processedCategories: [],
      lastUpdatedAt: new Date().toISOString()
    };
    await db.collection('harvester_jobs').doc(harvesterJobId).set(initialHarvesterJob);
    console.log(`\n📺 Seeding dashboard Harvester Job: ${harvesterJobId}`);
  }

  for (let i = 0; i < targetsToProcess.length; i++) {
    const idx = i;
    const target = targetsToProcess[idx];
    const pathLabel = `${target.mainName} > ${target.subName}${target.subSubName ? ' > ' + target.subSubName : ''}`;
    const leafSlug = target.subSubSlug || target.subSlug;

    if (APPLY) {
      await db.collection('harvester_jobs').doc(harvesterJobId).update({
        currentCategory: pathLabel,
        lastUpdatedAt: new Date().toISOString()
      });
    }

    console.log(`\n[${idx + 1}/${targetsToProcess.length}] Processing Category: ${pathLabel}`);
    console.log(`  Slugs: ${target.mainSlug}/${target.subSlug}/${target.subSubSlug || ''}`);

    try {
      // Step A: Seed standard import profile if missing
      const profileName = `Auto: ${target.subSubName || target.subName}`;
      const profileQuery = await db.collection('importProfiles')
        .where('vendorId', '==', 'aliexpress')
        .where('name', '==', profileName)
        .limit(1)
        .get();

      let profileId = '';
      if (profileQuery.empty) {
        const newProfile = {
          name: profileName,
          vendorId: 'aliexpress',
          enabled: true,
          filters: {
            searchQuery: target.keywords[0] || '',
            minPrice: 5,
            maxPrice: 10000,
            minRating: 3.5,
            minDiscount: 10,
          },
          mapping: {
            targetMainCategory: target.mainSlug,
            targetSubCategory: target.subSlug,
            targetSubSubCategory: target.subSubSlug || null,
            priceMarkup: 1.0,
            defaultStatus: 'approved',
          },
          maxItemsPerRun: MAX_PRODUCTS,
          deduplicationStrategy: 'skip',
          createdBy: 'system-auto-bulk',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const profileRef = await db.collection('importProfiles').add(newProfile);
        profileId = profileRef.id;
        console.log(`  ✓ Seeded Import Profile: ${profileName} (${profileId})`);
      } else {
        profileId = profileQuery.docs[0].id;
        console.log(`  - Import Profile exists: ${profileName} (${profileId})`);
      }

      // Step B: Trigger imports based on MODE
      if (MODE === 'queue') {
        // Enqueue a job in the old "jobs" collection
        const newJob = {
          type: 'import_aliexpress',
          status: 'pending',
          payload: {
            mainCategory: target.mainSlug,
            subCategory: target.subSlug,
            subSubCategory: target.subSubSlug || '',
            itemsPerCategory: MAX_PRODUCTS,
            draftStatus: 'approved',
          },
          createdAt: new Date().toISOString(),
          retryCount: 0,
          maxRetries: 3,
        };

        const jobRef = await db.collection('jobs').add(newJob);
        console.log(`  ✓ Enqueued job in 'jobs' collection (${jobRef.id})`);
        successCount++;
      } else {
        // MODE === 'direct'
        // Create an import_jobs log document
        const jobLogRef = db.collection('import_jobs').doc();
        await jobLogRef.set({
          id: jobLogRef.id,
          type: 'category-import',
          importerType: 'keyword-search',
          status: 'running',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          logs: [],
          progress: {
            totalCategories: 1,
            processedCategories: 0,
            currentCategory: pathLabel,
            importedProducts: 0,
            errors: []
          }
        });

        // Run the pipeline directly
        const pipelineResult = await runProductImportPipeline({
          jobId: jobLogRef.id,
          keywords: target.keywords,
          maxProducts: MAX_PRODUCTS,
          categoryPath: [target.mainName, target.subName, target.subSubName || target.subName],
          categorySlugEN: target.mainSlug,
          subcategorySlugEN: target.subSlug,
          subsubcategorySlugEN: target.subSubSlug,
          categoryNamePL: target.mainName,
          subcategoryNamePL: target.subName,
          subsubcategoryNamePL: target.subSubName,
          importerType: 'keyword-search',
          currencyRate: 4.0,
          fetch: { 
            batchSize: 50, 
            delayBetweenItems: BYPASS_REFINEMENT ? 50 : 200, 
            delayBetweenBatches: BYPASS_REFINEMENT ? 100 : 500 
          },
          dedupe: { minRating: 2.5, minOrders: 5 },
          enrich: { 
            batchSize: BYPASS_REFINEMENT ? 10 : 1, 
            delayBetweenItems: BYPASS_REFINEMENT ? 0 : 4000, 
            delayBetweenBatches: BYPASS_REFINEMENT ? 0 : 2000 
          },
          save: { skipExisting: false },
          bypassRefinement: BYPASS_REFINEMENT,
        });

        const imported = pipelineResult.saved.created.length + pipelineResult.saved.updated.length;
        console.log(`  ✓ Import finished. Saved ${imported} products (Created: ${pipelineResult.saved.created.length}, Updated: ${pipelineResult.saved.updated.length})`);
        successCount++;

        if (APPLY) {
          const progressPercent = Math.round(((idx + 1) / targetsToProcess.length) * 100);
          const incrementData = {
            productsFound: FieldValue.increment(pipelineResult.fetched.length),
            productsCreated: FieldValue.increment(pipelineResult.saved.created.length),
            dealsCreated: FieldValue.increment(pipelineResult.saved.created.length + pipelineResult.saved.updated.length),
            duplicatesSkipped: FieldValue.increment(pipelineResult.saved.skipped.length),
            progress: progressPercent,
            lastUpdatedAt: new Date().toISOString(),
            processedCategories: FieldValue.arrayUnion({
              category: pathLabel,
              count: imported,
              status: 'ok'
            })
          };
          await db.collection('harvester_jobs').doc(harvesterJobId).update(incrementData);
        }
      }

    } catch (err: any) {
      console.error(`  ❌ Error processing category ${leafSlug}:`, err?.message || err);
      errorCount++;

      if (APPLY) {
        const progressPercent = Math.round(((idx + 1) / targetsToProcess.length) * 100);
        await db.collection('harvester_jobs').doc(harvesterJobId).update({
          progress: progressPercent,
          lastUpdatedAt: new Date().toISOString(),
          processedCategories: FieldValue.arrayUnion({
            category: pathLabel,
            count: 0,
            status: 'error'
          })
        });
      }
    }

    // Delay between categories to prevent rate limiting
    if (idx < targetsToProcess.length - 1 && MODE === 'direct') {
      console.log(`  Waiting ${DELAY}ms before next category...`);
      await new Promise(resolve => setTimeout(resolve, DELAY));
    }
  }

  console.log('\n============================================================');
  console.log('✅ Bulk Category Population Setup Completed!');
  console.log(`Summary:`);
  console.log(`  - Categories processed: ${successCount}`);
  console.log(`  - Errors: ${errorCount}`);
  console.log(`  - Total leaf nodes: ${targetsToProcess.length}`);
  console.log('============================================================\n');

  if (APPLY) {
    await db.collection('harvester_jobs').doc(harvesterJobId).update({
      status: errorCount === targetsToProcess.length ? 'failed' : 'completed',
      completedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString()
    });
  }
}

main().catch((err) => {
  console.error('❌ Fatal error in bulk population:', err);
  process.exit(1);
});
