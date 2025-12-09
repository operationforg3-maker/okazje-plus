import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { ImportQueueManager, ImportJob } from '@/lib/import-queue';
import { adminDb } from '@/lib/firebase-admin';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';
import { CATEGORY_STRUCTURE } from '@/lib/category-structure';

/**
 * Helper: Get importKeywords from Firestore or fallback to category-structure.ts
 */
function getImportKeywordsFromStructure(categorySlug: string, subcategorySlug: string, subsubSlug: string): string[] {
  try {
    // Search in CATEGORY_STRUCTURE for matching slugs
    for (const cat of CATEGORY_STRUCTURE) {
      if (cat.slug !== categorySlug) continue;
      
      if (cat.subcategories) {
        for (const sub of cat.subcategories) {
          if (sub.slug !== subcategorySlug) continue;
          
          if (sub.subcategories) {
            for (const subsub of sub.subcategories) {
              if (subsub.slug === subsubSlug && subsub.importKeywords?.length) {
                return subsub.importKeywords;
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[getImportKeywordsFromStructure] Error searching structure:', e);
  }
  return [];
}

/**
 * POST /api/admin/import/queue
 * 
 * Create new background import job and start processing immediately
 * Returns immediately with job ID for tracking
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin authorization
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      sources = {},
      maxProductsPerCategory = 20,
      enableAdvancedFeatures = true,
      enableAIEnrichment = true,
      saveDraftsOnly = true,
    } = body;

    // Get enabled sources
    const enabledSources = Object.entries(sources)
      .filter(([_, enabled]) => enabled)
      .map(([source]) => source);

    if (enabledSources.length === 0) {
      return NextResponse.json(
        { error: 'No sources enabled' },
        { status: 400 }
      );
    }

    // Create job
    const jobId = await ImportQueueManager.createJob(
      enabledSources,
      {
        maxProductsPerCategory,
        enableAdvancedFeatures,
        enableAIEnrichment,
        saveDraftsOnly,
      },
      authResult.uid!
    );

    // Start processing immediately in background (don't wait)
    processImportJobInBackground(jobId, {
      sources: enabledSources,
      config: {
        maxProductsPerCategory,
        enableAdvancedFeatures,
        enableAIEnrichment,
        saveDraftsOnly,
      },
    }).catch((e) => {
      console.error(`[POST /api/admin/import/queue] Background processor failed for job ${jobId}:`, e);
    });
    
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Import job created and processing started. Use GET /api/admin/import/queue/{jobId} to track progress.',
    });
  } catch (error: any) {
    console.error('[POST /api/admin/import/queue] Error:', error);
    console.error('[POST /api/admin/import/queue] Error stack:', error?.stack);
    console.error('[POST /api/admin/import/queue] Error message:', error?.message);
    return NextResponse.json(
      { error: error.message || 'Failed to create import job', details: error?.toString() },
      { status: 500 }
    );
  }
}

/**
 * Process import job in background
 */
async function processImportJobInBackground(jobId: string, jobData: { sources: string[]; config: ImportJob['config'] }): Promise<void> {
  const jobRef = adminDb.collection('importJobs').doc(jobId);

  try {
    console.log(`[Import Queue] Starting background processing for job ${jobId}`);

    // Mark as running
    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    const { sources, config } = jobData;
    const maxProductsPerCategory = config.maxProductsPerCategory || 20;

    // Get all categories with sub-subcategories
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
            // Build English keywords from multiple sources with fallback chain
            let englishKeywords: string[] = [];
            
            // Priority 1: Use importKeywords from Firestore if present
            if (subsub.importKeywords?.length) {
              englishKeywords = subsub.importKeywords;
              console.log(`  [keywords] Using Firestore importKeywords for ${subsub.slug}: ${englishKeywords.join(', ')}`);
            }
            // Priority 2: Use translations.en.name
            else if (subsub.translations?.en?.name) {
              englishKeywords = [subsub.translations.en.name];
              console.log(`  [keywords] Using translations.en.name for ${subsub.slug}: ${englishKeywords.join(', ')}`);
            }
            // Priority 3: Fallback to category-structure.ts
            else {
              const structureKeywords = getImportKeywordsFromStructure(cat.slug, sub.slug, subsub.slug);
              if (structureKeywords.length) {
                englishKeywords = structureKeywords;
                console.log(`  [keywords] Using category-structure.ts for ${subsub.slug}: ${englishKeywords.join(', ')}`);
              }
            }
            // Priority 4: Last resort - use English name of subcategory
            if (!englishKeywords.length) {
              englishKeywords = [subsub.name];
              console.warn(`  [keywords] WARNING: Using fallback name for ${subsub.slug}: ${englishKeywords.join(', ')}`);
            }
            
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

    console.log(`[Import Queue] Job ${jobId}: Created ${batches.length} batches`);

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
    const { runProductImportPipeline } = await import('@/ai/flows/importerFlow');

    let totalImported = 0;
    let processedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // Check if cancelled
      const currentSnap = await jobRef.get();
      const currentData = currentSnap.data();
      if (currentData?.status === 'cancelled') {
        console.log(`[Import Queue] Job ${jobId} cancelled`);
        return;
      }

      console.log(`[Import Queue] Job ${jobId}: Processing batch ${i + 1}/${batches.length}: ${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`);

      try {
        // Use English importKeywords for AliExpress API search
        const keywords = batch.importKeywords.length > 0 
          ? batch.importKeywords 
          : [batch.subsubcategoryName]; // Fallback

        const pipelineResult = await runProductImportPipeline({
          jobId,
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

        totalImported += pipelineResult.saved.created.length + pipelineResult.saved.updated.length;
        processedCount++;

        await jobRef.update({
          'progress.processedCategories': processedCount,
          'progress.currentCategory': `${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`,
          'progress.importedProducts': totalImported,
        });

      } catch (err) {
        const errorMsg = `Batch ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(errorMsg);
        console.error(`[Import Queue] Job ${jobId} batch failed:`, errorMsg);
      }
    }

    // Get job start time for duration calculation
    const jobSnap = await jobRef.get();
    const startedAtStr = jobSnap.data()?.startedAt;
    const startTime = startedAtStr ? new Date(startedAtStr).getTime() : Date.now();
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // Mark as completed
    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      'progress.errors': errors,
      results: {
        totalProducts: totalImported,
        totalVariants: 0,
        duration: durationSeconds, // Duration in seconds, not timestamp!
      },
    });

    console.log(`[Import Queue] Job ${jobId} completed: ${totalImported} products imported`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Import Queue] Job ${jobId} failed:`, errorMessage);

    await jobRef.update({
      status: 'failed',
      completedAt: new Date().toISOString(),
      'progress.errors': [errorMessage],
    });

    throw error;
  }
}

/**
 * GET /api/admin/import/queue?userId={uid}
 * 
 * List user's import jobs
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin authorization
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.uid!;
    const jobs = await ImportQueueManager.listUserJobs(userId);

    return NextResponse.json({
      success: true,
      jobs,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/import/queue] Error:', error);
    console.error('[GET /api/admin/import/queue] Error stack:', error?.stack);
    console.error('[GET /api/admin/import/queue] Error message:', error?.message);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs', details: error?.toString() },
      { status: 500 }
    );
  }
}
