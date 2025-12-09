import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { ImportQueueManager, ImportJob } from '@/lib/import-queue';
import { adminDb } from '@/lib/firebase-admin';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';
import { CATEGORY_STRUCTURE } from '@/lib/category-structure';
import { aiGenerateSearchKeywords } from '@/ai/flows/aliexpress/aiGenerateSearchKeywords';

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
  console.log('[POST /api/admin/import/queue] ===== REQUEST START =====');
  try {
    // Check admin authorization
    console.log('[POST /api/admin/import/queue] Checking admin authorization...');
    const authResult = await checkAdminAuth(req);
    console.log('[POST /api/admin/import/queue] Auth result:', { authorized: authResult.authorized, uid: authResult.uid });
    if (!authResult.authorized) {
      console.error('[POST /api/admin/import/queue] ❌ Not authorized:', authResult.error);
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    console.log('[POST /api/admin/import/queue] Request body:', body);
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

    console.log('[POST /api/admin/import/queue] Enabled sources:', enabledSources);

    if (enabledSources.length === 0) {
      console.error('[POST /api/admin/import/queue] ❌ No sources enabled');
      return NextResponse.json(
        { error: 'No sources enabled' },
        { status: 400 }
      );
    }

    // Create job
    console.log('[POST /api/admin/import/queue] Creating job in Firestore...');
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
    console.log('[POST /api/admin/import/queue] ✅ Job created:', jobId);

    // Start processing immediately in background (don't wait)
    console.log('[POST /api/admin/import/queue] Starting background processor (async)...');
    processImportJobInBackground(jobId, {
      sources: enabledSources,
      config: {
        maxProductsPerCategory,
        enableAdvancedFeatures,
        enableAIEnrichment,
        saveDraftsOnly,
      },
    }).catch((e) => {
      console.error(`[POST /api/admin/import/queue] ❌ Background processor failed for job ${jobId}:`, e);
    });
    
    console.log('[POST /api/admin/import/queue] ===== RESPONSE SUCCESS =====');
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Import job created and processing started. Use GET /api/admin/import/queue/{jobId} to track progress.',
    });
  } catch (error: any) {
    console.error('[POST /api/admin/import/queue] ===== ERROR =====');
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
    console.log(`[Import Queue] ===== BACKGROUND PROCESSOR START for job ${jobId} =====`);
    console.log(`[Import Queue] Job config:`, jobData);

    // Mark as running
    console.log(`[Import Queue] Marking job ${jobId} as running...`);
    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
    });
    console.log(`[Import Queue] ✅ Job ${jobId} marked as running`);

    const { sources, config } = jobData;
    const maxProductsPerCategory = config.maxProductsPerCategory || 20;

    // Get all categories with sub-subcategories
    console.log(`[Import Queue] Fetching all categories...`);
    const categories = await getAllCategories();
    console.log(`[Import Queue] Found ${categories.length} categories`);
    
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
            
            // Priority 1: Use searchKeywords from AI (NEW - generated via admin panel)
            if (subsub.searchKeywords?.length) {
              englishKeywords = subsub.searchKeywords;
              console.log(`  [keywords] Using AI-generated searchKeywords for ${subsub.slug}: ${englishKeywords.join(', ')}`);
            }
            // Priority 2: Use importKeywords from Firestore if present
            else if (subsub.importKeywords?.length) {
              englishKeywords = subsub.importKeywords;
              console.log(`  [keywords] Using Firestore importKeywords for ${subsub.slug}: ${englishKeywords.join(', ')}`);
            }
            // Priority 3: Use translations.en.name
            else if (subsub.translations?.en?.name) {
              englishKeywords = [subsub.translations.en.name];
              console.log(`  [keywords] Using translations.en.name for ${subsub.slug}: ${englishKeywords.join(', ')}`);
            }
            // Priority 4: Fallback to category-structure.ts
            else {
              const structureKeywords = getImportKeywordsFromStructure(cat.slug, sub.slug, subsub.slug);
              if (structureKeywords.length) {
                englishKeywords = structureKeywords;
                console.log(`  [keywords] Using category-structure.ts for ${subsub.slug}: ${englishKeywords.join(', ')}`);
              }
            }
            // Priority 5: Last resort - use English name of subcategory
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

    console.log(`[Import Queue] Built ${batches.length} batches from categories`);

    // Update total count
    console.log(`[Import Queue] Updating job ${jobId} with total categories: ${batches.length}`);
    await jobRef.update({
      'progress.totalCategories': batches.length,
    });

    // Get currency rate
    console.log(`[Import Queue] Fetching currency rate...`);
    let currencyRate = 4.0;
    try {
      const configDoc = await adminDb.collection('config').doc('importSettings').get();
      if (configDoc.exists) {
        currencyRate = configDoc.data()?.currencyRate || 4.0;
        console.log(`[Import Queue] Currency rate: ${currencyRate}`);
      }
    } catch (_) {
      console.warn(`[Import Queue] Could not fetch currency rate, using default: ${currencyRate}`);
    }

    // Run import pipeline
    console.log(`[Import Queue] Loading import pipeline...`);
    const { runProductImportPipeline } = await import('@/ai/flows/importerFlow');
    console.log(`[Import Queue] ✅ Pipeline loaded`);

    let totalImported = 0;
    let processedCount = 0;
    const errors: string[] = [];

    console.log(`[Import Queue] ===== STARTING BATCH PROCESSING (${batches.length} batches) =====`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // Check if cancelled
      const currentSnap = await jobRef.get();
      const currentData = currentSnap.data();
      if (currentData?.status === 'cancelled') {
        console.log(`[Import Queue] Job ${jobId} cancelled by user`);
        return;
      }

      console.log(`[Import Queue] Job ${jobId}: Batch ${i + 1}/${batches.length} START`);
      console.log(`[Import Queue]   Category: ${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`);
      console.log(`[Import Queue]   Keywords: ${batch.importKeywords.join(', ')}`);

      try {
        // Use English importKeywords for AliExpress API search
        let keywords = batch.importKeywords.length > 0 
          ? batch.importKeywords 
          : [batch.subsubcategoryName]; // Fallback
        
        console.log(`[Import Queue]   Using keywords: ${keywords.join(', ')}`);

        // If keywords are weak (only 1 or Polish name), enhance with AI-generated keywords
        const shouldEnhanceKeywords = keywords.length <= 1 || keywords.some(k => k.match(/[ąćęłńóśźż]/i));
        
        if (shouldEnhanceKeywords && config.enableAIEnrichment) {
          try {
            console.log(`[Import Queue]   🤖 Enhancing weak keywords with AI...`);
            const aiKeywords = await aiGenerateSearchKeywords({
              categoryName: batch.categoryName,
              subcategoryName: batch.subcategoryName,
              subsubcategoryName: batch.subsubcategoryName,
              fallbackKeywords: keywords,
            });
            keywords = aiKeywords.keywords;
            console.log(`[Import Queue]   ✅ AI enhanced to ${keywords.length} keywords: ${keywords.join(', ')}`);
          } catch (e) {
            console.warn(`[Import Queue]   ⚠️ AI keyword enhancement failed, using original keywords`);
            // Keep original keywords
          }
        }

        console.log(`[Import Queue]   Running pipeline for keywords: ${keywords.join(', ')}`);
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

        const batchTotal = pipelineResult.saved.created.length + pipelineResult.saved.updated.length;
        console.log(`[Import Queue] Job ${jobId}: Batch ${i + 1} result: created=${pipelineResult.saved.created.length}, updated=${pipelineResult.saved.updated.length}, total=${batchTotal}`);
        
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
        console.error(`[Import Queue] Job ${jobId} batch ${i + 1} FAILED:`, errorMsg);
      }
    }

    console.log(`[Import Queue] ===== BATCH PROCESSING COMPLETE =====`);
    console.log(`[Import Queue] Job ${jobId}: Total processed: ${processedCount}/${batches.length}, Total imported: ${totalImported}`);

    // Get job start time for duration calculation
    const jobSnap = await jobRef.get();
    const startedAtStr = jobSnap.data()?.startedAt;
    const startTime = startedAtStr ? new Date(startedAtStr).getTime() : Date.now();
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    console.log(`[Import Queue] Job ${jobId}: Finalizing... (duration: ${durationSeconds}s)`);

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

    console.log(`[Import Queue] ===== BACKGROUND PROCESSOR SUCCESS =====`);
    console.log(`[Import Queue] Job ${jobId} completed: ${totalImported} products imported in ${durationSeconds}s`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Import Queue] ===== BACKGROUND PROCESSOR ERROR =====`);
    console.error(`[Import Queue] Job ${jobId} failed:`, errorMessage);
    console.error(`[Import Queue] Error stack:`, error instanceof Error ? error.stack : 'N/A');

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
