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
import typesenseAdminClient from '@/lib/typesense-admin';
import { isBackgroundProcessingEnabled } from '@/lib/system-settings';

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
const HARVESTER_STALE_MS = 15 * 60 * 1000;
const MAX_TYPESENSE_TASKS_PER_RUN = 100;
const MAX_TYPESENSE_QUEUE_RETRIES = 5;

type TypesenseQueueEntity = 'products' | 'deals';
type TypesenseQueueOperation = 'upsert' | 'delete';

interface TypesenseQueueTask {
  id: string;
  entity: TypesenseQueueEntity;
  operation: TypesenseQueueOperation;
  itemId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts?: number;
  lastError?: string;
}

const ensureStringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const ensureNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const localizeText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const pl = ensureStringValue((value as any).pl, '');
    const en = ensureStringValue((value as any).en, '');
    return pl || en || '';
  }
  return '';
};

async function mapQueueDocument(entity: TypesenseQueueEntity, itemId: string): Promise<any | null> {
  if (entity === 'deals') {
    const docSnap = await adminDb.collection('deals').doc(itemId).get();
    if (!docSnap.exists) return null;
    const data = docSnap.data() as Record<string, any>;
    return {
      id: itemId,
      title: localizeText(data.title),
      description: localizeText(data.description),
      price: ensureNumberValue(data.price?.amount ?? data.price, 0),
      originalPrice: data.originalPrice !== undefined ? ensureNumberValue(data.originalPrice, 0) : undefined,
      mainCategorySlug: ensureStringValue(data.mainCategorySlug, 'inne'),
      subCategorySlug: ensureStringValue(data.subCategorySlug, 'inne'),
      subSubCategorySlug: ensureStringValue(data.subSubCategorySlug, ''),
      status: ensureStringValue(data.status, 'draft'),
      temperature: ensureNumberValue(data.temperature, 0),
      voteCount: ensureNumberValue(data.voteCount, 0),
      postedBy: ensureStringValue(data.postedBy, 'system'),
    };
  }

  // entity === 'products'
  // Try product_cores first (M6 canonical), fallback to legacy products
  let docSnap = await adminDb.collection('product_cores').doc(itemId).get();
  if (!docSnap.exists) {
    docSnap = await adminDb.collection('products').doc(itemId).get();
  }

  if (!docSnap.exists) return null;

  const data = docSnap.data() as Record<string, any>;
  return {
    id: itemId,
    name: ensureStringValue(data.name || data.title, localizeText(data.title)),
    description: ensureStringValue(data.description || data.shortDescription, localizeText(data.shortDescription)),
    longDescription: ensureStringValue(data.longDescription || data.fullDescription, localizeText(data.fullDescription)),
    image: ensureStringValue(data.image || data.imageUrl, data.imageUrl || ''),
    affiliateUrl: ensureStringValue(data.affiliateUrl || data.url, '#'),
    price: ensureNumberValue(data.bestPrice?.amount ?? data.price?.amount ?? data.price, 0),
    originalPrice: data.originalPrice !== undefined ? ensureNumberValue(data.originalPrice, 0) : undefined,
    mainCategorySlug: ensureStringValue(data.mainCategorySlug, 'inne'),
    subCategorySlug: ensureStringValue(data.subCategorySlug, 'inne'),
    subSubCategorySlug: ensureStringValue(data.subSubCategorySlug, ''),
    status: ensureStringValue(data.status, 'draft'),
    ratingCard_average: ensureNumberValue(data.ratingCard?.average ?? data.rating?.score, 0),
    ratingCard_count: Math.round(ensureNumberValue(data.ratingCard?.count ?? data.rating?.count, 0)),
  };
}

async function processTypesenseQueueTask(task: TypesenseQueueTask): Promise<void> {
  const taskRef = adminDb.collection('typesense_index_queue').doc(task.id);
  const attempts = task.attempts || 0;

  await taskRef.set(
    {
      status: 'processing',
      updatedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  try {
    if (!typesenseAdminClient) {
      throw new Error('Typesense admin client is not configured (missing TYPESENSE_ADMIN_API_KEY)');
    }

    if (task.operation === 'delete') {
      try {
        await (typesenseAdminClient as any).collections(task.entity).documents(task.itemId).delete();
      } catch (error) {
        // Document might not exist in index, which is fine for delete semantics.
        logger.warn('Typesense delete returned warning', {
          queueTaskId: task.id,
          entity: task.entity,
          itemId: task.itemId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      const mapped = await mapQueueDocument(task.entity, task.itemId);
      if (!mapped) {
        await taskRef.set(
          {
            status: 'completed',
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            note: 'Source document not found, nothing to index',
          },
          { merge: true }
        );
        return;
      }

      await (typesenseAdminClient as any)
        .collections(task.entity)
        .documents()
        .import([mapped], { action: 'upsert' });
    }

    await taskRef.set(
      {
        status: 'completed',
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        attempts,
        lastError: null,
      },
      { merge: true }
    );
  } catch (error) {
    const nextAttempts = attempts + 1;
    const permanentFailure = nextAttempts >= MAX_TYPESENSE_QUEUE_RETRIES;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await taskRef.set(
      {
        status: permanentFailure ? 'failed' : 'pending',
        attempts: nextAttempts,
        lastError: errorMessage,
        updatedAt: new Date().toISOString(),
        ...(permanentFailure ? { failedAt: new Date().toISOString() } : {}),
      },
      { merge: true }
    );

    throw error;
  }
}

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

    // ===== MASTER SWITCH CHECK =====
    const enabled = await isBackgroundProcessingEnabled('harvesterEnabled');
    if (!enabled) {
      logger.info('[ProcessJobs Cron] Aborted execution: Background processing disabled by Master Switch.');
      return NextResponse.json({
        success: true,
        disabled: true,
        message: 'Procesy w tle są wyłączone przez Master Switch.',
        timestamp: new Date().toISOString(),
      });
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

    // ===== FETCH PENDING TYPESENSE QUEUE TASKS =====
    const typesenseQueueSnapshot = await adminDb
      .collection('typesense_index_queue')
      .where('status', '==', 'pending')
      .limit(MAX_TYPESENSE_TASKS_PER_RUN)
      .get();

    const typesenseQueueTasks = typesenseQueueSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as TypesenseQueueTask[];

    // ===== WATCHDOG: MARK STALE HARVESTER JOBS AS FAILED =====
    const runningHarvesterSnapshot = await adminDb
      .collection('harvester_jobs')
      .where('status', '==', 'running')
      .limit(50)
      .get();

    const now = Date.now();
    let staleHarvesterJobsDetected = 0;
    let staleHarvesterJobsMarked = 0;

    for (const doc of runningHarvesterSnapshot.docs) {
      const data = doc.data() as any;
      const lastUpdatedAtMs = Date.parse(data?.lastUpdatedAt || '');
      if (!Number.isFinite(lastUpdatedAtMs)) {
        continue;
      }

      if (now - lastUpdatedAtMs <= HARVESTER_STALE_MS) {
        continue;
      }

      staleHarvesterJobsDetected += 1;
      const existingLogs = Array.isArray(data?.logs) ? data.logs : [];

      await doc.ref.set(
        {
          status: 'failed',
          completedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          orphaned: true,
          orphanedReason: `Brak heartbeat > ${Math.round(HARVESTER_STALE_MS / 60000)} min`,
          logs: [
            ...existingLogs.slice(-199),
            {
              level: 'error',
              message: `Watchdog: job oznaczony jako osierocony (brak heartbeat > ${Math.round(HARVESTER_STALE_MS / 60000)} min)`,
              timestamp: new Date().toISOString(),
            },
          ],
        },
        { merge: true }
      );

      staleHarvesterJobsMarked += 1;
    }

    logger.info('Cron job processor started', {
      jobsFound: jobs.length,
      importJobsQueued: importJobsToResume.length,
      uiImportJobsPending: uiImportJobsToProcess.length,
      typesenseQueuePending: typesenseQueueTasks.length,
      staleHarvesterJobsDetected,
      staleHarvesterJobsMarked,
      maxPerRun: MAX_JOBS_PER_RUN,
    });

    // ===== PROCESS OLD SYSTEM JOBS =====
    const results = await Promise.allSettled(jobs.map(job => processJob(job)));

    // ===== RESUME QUEUED IMPORT_JOBS =====
    const importResults = await Promise.allSettled(
      importJobsToResume.map(async (importJob: any) => {
        logger.info('Resuming queued import_job - SKIPPED (Legacy System moved)', { jobId: importJob.id, type: importJob.type, importerType: importJob.importerType });
        return { status: 'skipped', reason: 'Legacy import system archived' };
        /* 
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
        */
      })
    );

    // ===== PROCESS UI IMPORT JOBS (from importJobs collection) =====
    const uiImportResults = await Promise.allSettled(
      uiImportJobsToProcess.map(async (uiJob: any) => {
        logger.info('Processing UI import job', { jobId: uiJob.id, sources: uiJob.sources });
        return processUIImportJob(uiJob);
      })
    );

    // ===== PROCESS TYPESENSE INDEX QUEUE =====
    const typesenseQueueResults = await Promise.allSettled(
      typesenseQueueTasks.map((task) => processTypesenseQueueTask(task))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const importSuccessful = importResults.filter(r => r.status === 'fulfilled').length;
    const importFailed = importResults.filter(r => r.status === 'rejected').length;
    const uiImportSuccessful = uiImportResults.filter(r => r.status === 'fulfilled').length;
    const uiImportFailed = uiImportResults.filter(r => r.status === 'rejected').length;
    const typesenseQueueSuccessful = typesenseQueueResults.filter(r => r.status === 'fulfilled').length;
    const typesenseQueueFailed = typesenseQueueResults.filter(r => r.status === 'rejected').length;
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
      typesenseQueueProcessed: typesenseQueueTasks.length,
      typesenseQueueSuccessful,
      typesenseQueueFailed,
      staleHarvesterJobsDetected,
      staleHarvesterJobsMarked,
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
      typesenseQueueProcessed: typesenseQueueTasks.length,
      typesenseQueueSuccessful,
      typesenseQueueFailed,
      staleHarvesterJobsDetected,
      staleHarvesterJobsMarked,
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

    let currencyRate = 4.0;
    let autoApprove = false;
    let isPaused = false;
    try {
      const configDoc = await adminDb.collection('config').doc('importSettings').get();
      if (configDoc.exists) {
        currencyRate = configDoc.data()?.currencyRate || 4.0;
        autoApprove = !!configDoc.data()?.autoApprove;
        isPaused = !!configDoc.data()?.isPaused;
      }
    } catch (_) {}

    if (isPaused) {
      logger.info('Importy są aktualnie zatrzymane (isPaused=true w bazie)', { jobId: uiJob.id });
      await jobRef.update({
        status: 'failed',
        error: 'Proces zatrzymany (pauza) z poziomu panelu administratora.',
        completedAt: new Date(),
      });
      return NextResponse.json({ success: false, reason: 'paused' });
    }

    // Run import pipeline
    // Timeout wrapper for importerFlow
    const timeout2 = new Promise((_, reject) => setTimeout(() => reject(new Error('importerFlow import timeout (20s)')), 20000));
    const mod2 = await Promise.race([import('@/ai/flows/importerFlow'), timeout2]) as any;
    const { runProductImportPipeline } = mod2;

    let totalImported = 0;
    let processedCount = 0;
    const errors: string[] = [];

    // Track execution time to avoid serverless function timeouts
    const executionStartTime = Date.now();
    const MAX_EXECUTION_TIME_MS = 45000; // 45 seconds safe limit

    const progress = uiJob.progress || {};
    const startIndex = progress.currentBatchIndex || 0;

    for (let i = startIndex; i < batches.length; i++) {
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
          autoApprove,
          fetch: { batchSize: 50, delayBetweenItems: 200, delayBetweenBatches: 1000 },
          dedupe: { batchSize: 50, minRating: 2.5, minOrders: 10 },
          enrich: { batchSize: 5, delayBetweenItems: 300, delayBetweenBatches: 2000 },
          translate: { batchSize: 10, delayBetweenItems: 50, delayBetweenBatches: 300 },
          save: { batchSize: 5, skipExisting: false },
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
            // Translation is now part of enrichment
            refiner: pipelineResult.enriched.length,
          });
        }
        
        totalImported += batchTotal;
        processedCount++;

        await jobRef.update({
          'progress.processedCategories': processedCount,
          'progress.currentCategory': `${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`,
          'progress.importedProducts': totalImported,
          'progress.currentBatchIndex': i + 1,
          updatedAt: new Date().toISOString(),
        });

      } catch (err) {
        const errorMsg = `Batch ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        logger.error('UI Import batch failed', { jobId: uiJob.id, batch: i, error: errorMsg });
      }

      // Break if we are approaching timeout limit to avoid cron failing
      if (Date.now() - executionStartTime > MAX_EXECUTION_TIME_MS) {
        logger.info('UI Import job approaching timeout, suspending until next cron run', {
          jobId: uiJob.id,
          nextBatchIndex: i + 1,
          totalBatches: batches.length
        });
        // Save progress, do not mark as completed. Return early.
        await jobRef.update({
          'progress.currentBatchIndex': i + 1,
          updatedAt: new Date().toISOString(),
        });
        return;
      }
    }

    // If we finished all batches
    if (errors.length > 0) {
      await jobRef.update({
        status: 'completed_with_errors',
        error: errors.join('; '),
        completedAt: new Date().toISOString(),
        'progress.errors': errors,
      });
    } else {
      await jobRef.update({
        status: 'completed',
        completedAt: new Date().toISOString(),
        results: {
          totalProducts: totalImported,
          totalVariants: 0,
          duration: Date.now() - new Date(uiJob.createdAt).getTime(),
        },
      });
    }

    logger.info('UI Import job fully completed', {
      jobId: uiJob.id,
      totalBatches: batches.length,
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
