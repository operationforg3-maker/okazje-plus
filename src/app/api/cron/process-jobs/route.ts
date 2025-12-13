/**
 * Job Processing Worker
 * 
 * Cron endpoint that:
 * 1. Fetches pending jobs from Firestore
 * 2. Executes each job based on type
 * 3. Updates job status (pending → processing → completed/failed)
 * 4. Handles retries and error logging
 * 
 * Call this endpoint periodically via Cloud Scheduler:
 * POST /api/cron/process-jobs?secret=CRON_SECRET
 * 
 * Job Types Supported:
 * - import_aliexpress: Product import from AliExpress (via import-batch endpoint)
 * - import_allegro: Product import from Allegro
 * - import_amazon: Product import from Amazon
 * - import_ebay: Product import from eBay
 * - verify_links: Validate affiliate URLs
 * - cleanup_products: Delete orphaned/invalid products
 * - repair_indexes: Rebuild Firestore/Typesense indexes
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

interface Job {
  id: string;
  type: 'import_aliexpress' | 'import_allegro' | 'import_amazon' | 'import_ebay' | 'verify_links' | 'cleanup_products' | 'repair_indexes';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: Record<string, any>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount?: number;
  maxRetries?: number;
}

const CRON_SECRET = process.env.CRON_SECRET || 'dev-secret-change-in-production';
const MAX_JOBS_PER_RUN = 10;
const MAX_RETRIES = 3;

export async function POST(req: NextRequest) {
  try {
    // ===== SECURITY: Verify CRON_SECRET =====
    const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-cron-secret');
    if (secret !== CRON_SECRET) {
      logger.warn('Cron job unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized - invalid CRON_SECRET' },
        { status: 401 }
      );
    }

    const startTime = Date.now();

    // ===== FETCH PENDING JOBS (old system: 'jobs' collection) =====
    const pendingJobsSnapshot = await adminDb
      .collection('jobs')
      .where('status', '==', 'pending')
      .limit(MAX_JOBS_PER_RUN)
      .get();

    const jobs = pendingJobsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Job[];

    // ===== FETCH QUEUED IMPORT_JOBS (new system: 'import_jobs' collection) =====
    const queuedImportJobsSnapshot = await adminDb
      .collection('import_jobs')
      .where('status', '==', 'queued')
      .limit(5)
      .get();

    const importJobsToResume = queuedImportJobsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // ===== FETCH PENDING IMPORT_JOBS from UI system ('importJobs' camelCase collection) =====
    const uiImportJobsSnapshot = await adminDb
      .collection('importJobs')
      .where('status', '==', 'pending')
      .limit(5)
      .get();

    const uiImportJobsToProcess = uiImportJobsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    logger.info('Cron job processor started', {
      jobsFound: jobs.length,
      importJobsQueued: importJobsToResume.length,
      uiImportJobsPending: uiImportJobsToProcess.length,
      maxPerRun: MAX_JOBS_PER_RUN,
    });

    // ===== PROCESS OLD SYSTEM JOBS =====
    const results = await Promise.allSettled(jobs.map(job => processJob(job)));

    // ===== RESUME QUEUED IMPORT_JOBS =====
    const importResults = await Promise.allSettled(
      importJobsToResume.map(async (importJob: any) => {
        logger.info('Resuming queued import_job', { jobId: importJob.id, type: importJob.type, importerType: importJob.importerType });
        // Timeout wrapper to avoid hanging on dynamic import
        const timeout1 = new Promise((_, reject) => setTimeout(() => reject(new Error('processImportJob import timeout (20s)')), 20000));
        const mod1 = await Promise.race([import('@/app/api/admin/import/start/route'), timeout1]) as any;
        const { processImportJob } = mod1;
        return processImportJob(
          importJob.id, 
          importJob.type, 
          importJob.maxItemsPerSubcategory,
          importJob.importerType || 'keyword-search' // Default to keyword-search for old jobs
        );
      })
    );

    // ===== PROCESS UI IMPORT JOBS (from importJobs collection) =====
    const uiImportResults = await Promise.allSettled(
      uiImportJobsToProcess.map(async (uiJob: any) => {
        logger.info('Processing UI import job', { jobId: uiJob.id, sources: uiJob.sources });
        return processUIImportJob(uiJob);
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const importSuccessful = importResults.filter(r => r.status === 'fulfilled').length;
    const importFailed = importResults.filter(r => r.status === 'rejected').length;
    const uiImportSuccessful = uiImportResults.filter(r => r.status === 'fulfilled').length;
    const uiImportFailed = uiImportResults.filter(r => r.status === 'rejected').length;
    const durationMs = Date.now() - startTime;

    logger.info('Cron job processor completed', {
      processed: jobs.length,
      successful,
      failed,
      importJobsResumed: importJobsToResume.length,
      importSuccessful,
      importFailed,
      uiImportJobsProcessed: uiImportJobsToProcess.length,
      uiImportSuccessful,
      uiImportFailed,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      processed: jobs.length,
      successful,
      failed,
      importJobsResumed: importJobsToResume.length,
      importSuccessful,
      importFailed,
      uiImportJobsProcessed: uiImportJobsToProcess.length,
      uiImportSuccessful,
      uiImportFailed,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cron job processor fatal error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Cron processor failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Process a single job:
 * 1. Mark as processing
 * 2. Execute based on type
 * 3. Mark as completed or failed
 * 4. Handle retries
 */
async function processJob(job: Job): Promise<void> {
  const jobRef = adminDb.collection('jobs').doc(job.id);

  try {
    logger.info('Job processing started', {
      jobId: job.id,
      type: job.type,
      payload: job.payload,
    });

    // Mark as processing
    await jobRef.update({
      status: 'processing',
      startedAt: new Date(),
    });

    // Execute based on type
    switch (job.type) {
      case 'import_aliexpress':
        await handleImportAliExpress(job);
        break;

      case 'import_allegro':
        await handleImportAllegro(job);
        break;

      case 'import_amazon':
        await handleImportAmazon(job);
        break;

      case 'import_ebay':
        await handleImportEBay(job);
        break;

      case 'verify_links':
        await handleVerifyLinks(job);
        break;

      case 'cleanup_products':
        await handleCleanupProducts(job);
        break;

      case 'repair_indexes':
        await handleRepairIndexes(job);
        break;

      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }

    // Mark as completed
    await jobRef.update({
      status: 'completed',
      completedAt: new Date(),
    });

    logger.info('Job completed', { jobId: job.id, type: job.type });
  } catch (error) {
    const retryCount = (job.retryCount || 0) + 1;
    const maxRetries = job.maxRetries || MAX_RETRIES;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Job processing failed', {
      jobId: job.id,
      type: job.type,
      error: errorMessage,
      retryCount,
      maxRetries,
    });

    if (retryCount < maxRetries) {
      // Retry: reset to pending
      await jobRef.update({
        status: 'pending',
        retryCount,
        error: errorMessage,
      });
    } else {
      // Max retries reached: mark as failed
      await jobRef.update({
        status: 'failed',
        error: errorMessage,
        retryCount,
        completedAt: new Date(),
      });
    }

    throw error;
  }
}

// ===== JOB HANDLERS =====

/**
 * Handle import_aliexpress job
 * Calls the real import-batch endpoint via fetch
 * Uses internal secret for inter-service authentication
 */
async function handleImportAliExpress(job: Job): Promise<void> {
  const { mainCategory, subCategory, subSubCategory, itemsPerCategory, draftStatus } = job.payload;

  // Call the real import-batch endpoint
  // For production: use x-internal-secret to bypass Firebase auth
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/products/import-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.CRON_SECRET || '',
    },
    body: JSON.stringify({
      source: 'aliexpress',
      mainCategory,
      subCategory,
      subSubCategory,
      itemsPerCategory: itemsPerCategory || 50,
      importType: 'products',
      draftStatus: draftStatus || 'pending_ai',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AliExpress import failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  logger.info('AliExpress import result', result);
}

/**
 * Handle import_allegro job
 * Calls import-batch endpoint with Allegro source
 */
async function handleImportAllegro(job: Job): Promise<void> {
  const { mainCategory, subCategory, subSubCategory, itemsPerCategory, draftStatus } = job.payload;

  if (!mainCategory || !subCategory || !subSubCategory) {
    throw new Error('Missing required category parameters for Allegro import');
  }

  logger.info('Allegro import started', {
    jobId: job.id,
    mainCategory,
    subCategory,
    subSubCategory,
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/products/import-batch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({
        source: 'allegro',
        mainCategory,
        subCategory,
        subSubCategory,
        itemsPerCategory: itemsPerCategory || 50,
        draftStatus: draftStatus || 'pending_ai',
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Allegro import failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  logger.info('Allegro import completed', {
    jobId: job.id,
    result,
  });
}

/**
 * Handle import_amazon job
 * Calls import-batch endpoint with Amazon source
 */
async function handleImportAmazon(job: Job): Promise<void> {
  const { mainCategory, subCategory, subSubCategory, itemsPerCategory, draftStatus } = job.payload;

  if (!mainCategory || !subCategory || !subSubCategory) {
    throw new Error('Missing required category parameters for Amazon import');
  }

  logger.info('Amazon import started', {
    jobId: job.id,
    mainCategory,
    subCategory,
    subSubCategory,
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/products/import-batch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({
        source: 'amazon',
        mainCategory,
        subCategory,
        subSubCategory,
        itemsPerCategory: itemsPerCategory || 50,
        draftStatus: draftStatus || 'pending_ai',
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Amazon import failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  logger.info('Amazon import completed', {
    jobId: job.id,
    result,
  });
}

/**
 * Handle import_ebay job
 * Calls import-batch endpoint with eBay source
 */
async function handleImportEBay(job: Job): Promise<void> {
  const { mainCategory, subCategory, subSubCategory, itemsPerCategory, draftStatus } = job.payload;

  if (!mainCategory || !subCategory || !subSubCategory) {
    throw new Error('Missing required category parameters for eBay import');
  }

  logger.info('eBay import started', {
    jobId: job.id,
    mainCategory,
    subCategory,
    subSubCategory,
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/products/import-batch`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.CRON_SECRET || '',
      },
      body: JSON.stringify({
        source: 'ebay',
        mainCategory,
        subCategory,
        subSubCategory,
        itemsPerCategory: itemsPerCategory || 50,
        draftStatus: draftStatus || 'pending_ai',
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay import failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  logger.info('eBay import completed', {
    jobId: job.id,
    result,
  });
}

/**
 * Handle verify_links job
 * Validates affiliate URLs and checks HTTP status
 * TODO: Real implementation with actual HTTP checks
 */
async function handleVerifyLinks(job: Job): Promise<void> {
  const { categorySlug, limit } = job.payload;

  logger.info('Link verification started', {
    categorySlug,
    limit: limit || 100,
  });

  // TODO: Implement actual HTTP health checks
  // 1. Fetch products from category
  // 2. Check each affiliateUrl with HEAD/GET request
  // 3. Update status in Firestore
  // 4. Track results

  throw new Error('Link verification not implemented');
}

/**
 * Handle cleanup_products job
 * Deletes orphaned or invalid products
 * TODO: Real implementation with batch delete
 */
async function handleCleanupProducts(job: Job): Promise<void> {
  const { minDaysOld, minPrice } = job.payload;

  logger.info('Product cleanup started', {
    minDaysOld: minDaysOld || 30,
    minPrice: minPrice || 0,
  });

  // TODO: Implement batch product deletion
  // 1. Query products matching criteria
  // 2. Delete in batches of 500
  // 3. Update category product counts
  // 4. Return stats

  throw new Error('Product cleanup not implemented');
}

/**
 * Handle repair_indexes job
 * Rebuilds Firestore composite indexes and Typesense sync
 * TODO: Real implementation
 */
async function handleRepairIndexes(job: Job): Promise<void> {
  const { indexType } = job.payload; // 'firestore', 'typesense', or 'all'

  logger.info('Index repair started', { indexType: indexType || 'all' });

  // TODO: Implement index repair
  // 1. For Firestore: Check missing indexes via Admin SDK
  // 2. For Typesense: Rebuild collections from products collection
  // 3. Log progress and errors

  throw new Error('Index repair not implemented');
}

/**
 * Process UI Import Job (from importJobs collection created by admin harvester UI)
 * This handles jobs created via /api/admin/import/queue endpoint
 */
async function processUIImportJob(uiJob: any): Promise<void> {
  const jobRef = adminDb.collection('importJobs').doc(uiJob.id);

  try {
    logger.info('UI Import job processing started', {
      jobId: uiJob.id,
      sources: uiJob.sources,
      config: uiJob.config,
    });

    // Mark as running
    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    const sources = uiJob.sources || [];
    const config = uiJob.config || {};
    const maxProductsPerCategory = config.maxProductsPerCategory || 20;

    // Get all categories with sub-subcategories
    const { getAllCategories, getSubcategories, getSubSubcategories } = await import('@/lib/data-admin');
    const categories = await getAllCategories();
    
    const batches: Array<{
      categoryId: string;
      categoryName: string;
      categorySlug: string;
      subcategoryId: string;
      subcategoryName: string;
      subcategorySlug: string;
      subsubcategoryId: string;
      subsubcategoryName: string;
      subsubcategorySlug: string;
      importKeywords: string[]; // English keywords for AliExpress API
    }> = [];

    for (const cat of categories) {
      const subcategories = await getSubcategories(cat.id);
      for (const sub of subcategories) {
        const subsubcategories = await getSubSubcategories(cat.id, sub.id);
        
        if (subsubcategories.length > 0) {
          for (const subsub of subsubcategories) {
            // Build English keywords from importKeywords or translations.en.name
            const englishKeywords = subsub.importKeywords?.length 
              ? subsub.importKeywords 
              : subsub.translations?.en?.name 
                ? [subsub.translations.en.name]
                : [subsub.name]; // Fallback to name (may be Polish)
            
            batches.push({
              categoryId: cat.id,
              categoryName: cat.name,
              categorySlug: cat.slug,
              subcategoryId: sub.id,
              subcategoryName: sub.name,
              subcategorySlug: sub.slug,
              subsubcategoryId: subsub.id,
              subsubcategoryName: subsub.name,
              subsubcategorySlug: subsub.slug,
              importKeywords: englishKeywords,
            });
          }
        } else {
          // No sub-subcategories, use subcategory as target
          batches.push({
            categoryId: cat.id,
            categoryName: cat.name,
            categorySlug: cat.slug,
            subcategoryId: sub.id,
            subcategoryName: sub.name,
            subcategorySlug: sub.slug,
            subsubcategoryId: sub.id,
            subsubcategoryName: sub.name,
            subsubcategorySlug: sub.slug,
            importKeywords: [sub.name], // Use subcategory name as keyword
          });
        }
      }
    }

    logger.info('UI Import job batches created', {
      jobId: uiJob.id,
      totalBatches: batches.length,
    });

    // Update total count
    await jobRef.update({
      'progress.totalCategories': batches.length,
    });

    // Get currency rate
    let currencyRate = 4.0;
    try {
      const configDoc = await adminDb.collection('config').doc('importSettings').get();
      if (configDoc.exists) {
        currencyRate = configDoc.data()?.currencyRate || 4.0;
      }
    } catch (_) {}

    // Run import pipeline
    // Timeout wrapper for importerFlow
    const timeout2 = new Promise((_, reject) => setTimeout(() => reject(new Error('importerFlow import timeout (20s)')), 20000));
    const mod2 = await Promise.race([import('@/ai/flows/importerFlow'), timeout2]) as any;
    const { runProductImportPipeline } = mod2;

    let totalImported = 0;
    let processedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // Check if cancelled
      const currentSnap = await jobRef.get();
      const currentData = currentSnap.data();
      if (currentData?.status === 'cancelled') {
        logger.info('UI Import job cancelled', { jobId: uiJob.id });
        return;
      }

      logger.info(`UI Import processing batch ${i + 1}/${batches.length}`, {
        jobId: uiJob.id,
        category: `${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`,
      });

      try {
        // Use English importKeywords for AliExpress API search
        const keywords = batch.importKeywords.length > 0 
          ? batch.importKeywords 
          : [batch.subsubcategoryName]; // Fallback

        const pipelineResult = await runProductImportPipeline({
          jobId: uiJob.id,
          keywords,
          maxProducts: maxProductsPerCategory,
          categoryPath: [batch.categoryName, batch.subcategoryName, batch.subsubcategoryName],
          categorySlugEN: batch.categorySlug,
          subcategorySlugEN: batch.subcategorySlug,
          subsubcategorySlugEN: batch.subsubcategorySlug,
          translateToPolish: true,
          currencyRate,
          fetch: { batchSize: 50, delayBetweenItems: 200, delayBetweenBatches: 1000 },
          dedupe: { batchSize: 50, minRating: 2.5, minOrders: 10 },
          enrich: { batchSize: 5, delayBetweenItems: 300, delayBetweenBatches: 2000 },
          translate: { batchSize: 10, delayBetweenItems: 50, delayBetweenBatches: 300 },
          save: { batchSize: 5, skipExisting: true },
        });

        const batchCreated = pipelineResult.saved.created.length;
        const batchUpdated = pipelineResult.saved.updated.length;
        const batchTotal = batchCreated + batchUpdated;
        
        if (batchTotal === 0) {
          logger.warn('UI Import batch yielded 0 products', {
            jobId: uiJob.id,
            batch: i,
            category: `${batch.categorySlug}/${batch.subcategorySlug}/${batch.subsubcategorySlug}`,
            fetched: pipelineResult.fetched.length,
            deduplicated: pipelineResult.deduplicated.length,
            enriched: pipelineResult.enriched.length,
            translated: pipelineResult.translated.length,
          });
        }
        
        totalImported += batchTotal;
        processedCount++;

        await jobRef.update({
          'progress.processedCategories': processedCount,
          'progress.currentCategory': `${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`,
          'progress.importedProducts': totalImported,
        });

      } catch (err) {
        const errorMsg = `Batch ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        logger.error('UI Import batch failed', { jobId: uiJob.id, batch: i, error: errorMsg });
      }
    }

    // Mark as completed
    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      'progress.errors': errors,
      results: {
        totalProducts: totalImported,
        totalVariants: 0,
        duration: Date.now() - new Date(uiJob.createdAt).getTime(),
      },
    });

    logger.info('UI Import job completed', {
      jobId: uiJob.id,
      totalImported,
      processedCount,
      errors: errors.length,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('UI Import job failed', {
      jobId: uiJob.id,
      error: errorMessage,
    });

    await jobRef.update({
      status: 'failed',
      completedAt: new Date().toISOString(),
      'progress.errors': [errorMessage],
    });

    throw error;
  }
}
