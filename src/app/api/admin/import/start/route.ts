import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, FieldValue } from '@/lib/firebase-admin';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';
import { CATEGORY_STRUCTURE } from '@/lib/category-structure';
import { getAliExpressCategoryIds } from '@/lib/aliexpress-category-mapping';

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
 * Uruchamia import produktów/okazji w trybie batch
 * POST /api/admin/import/start
 * Body: { type: 'products' | 'deals', maxItemsPerSubcategory: 10 }
 * Returns: { jobId: string, status: 'queued', totalBatches: number }
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[Import Start] POST request received');
    
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const bodyData = await req.json();
    console.log('[Import Start] Request body parsed:', Object.keys(bodyData));
    
    const { type = 'products', maxItemsPerSubcategory = 10, importerType = 'keyword-search' } = bodyData;
    console.log(`[Import Start] Params: type=${type}, importerType=${importerType}, maxItems=${maxItemsPerSubcategory}`);

    if (!['products', 'deals'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Use "products" or "deals"' }, { status: 400 });
    }

    if (!['keyword-search', 'hot-products', 'convertiser', 'category-direct'].includes(importerType)) {
      return NextResponse.json({ error: 'Invalid importerType' }, { status: 400 });
    }

    console.log(`[Import Start] Type: ${type}, Importer: ${importerType}, Max items per subcategory: ${maxItemsPerSubcategory}`);

    // Pobierz wszystkie kategorie i pod-podkategorie
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
    }> = [];

    for (const cat of categories) {
      const subcategories = await getSubcategories(cat.id);
      for (const sub of subcategories) {
        const subsubcategories = await getSubSubcategories(cat.id, sub.id);
        
        if (subsubcategories.length > 0) {
          for (const subsub of subsubcategories) {
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
            });
          }
        } else {
          // Bez pod-podkategorii, użyj subcategory
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
          });
        }
      }
    }

    console.log(`[Import Start] Created ${batches.length} batches`);

    // Utwórz job w Firestore
    const jobRef = adminDb.collection('import_jobs').doc();
    const jobId = jobRef.id;

    const now = new Date().toISOString();
    const jobData = {
      id: jobId,
      type,
      importerType, // NEW: store which importer is used
      sources: [importerType], // Track which sources are being imported
      status: 'queued', // queued | running | paused | completed | failed
      progress: {
        total: batches.length,
        completed: 0,
        failed: 0,
        current: 0,
      },
      batches,
      maxItemsPerSubcategory,
      createdAt: now,
      updatedAt: now,
      startedAt: now, // Set to now so sorting works
      completedAt: null,
      logs: [],
      itemsCreated: [], // Track IDs for rollback
      itemsUpdated: [], // Track IDs for rollback
    };

    console.log(`[Import Start] DEBUG: About to create job ${jobId} in firestore...`);
    console.log(`[Import Start] DEBUG: jobRef path = ${jobRef.path}, jobRef.id = ${jobRef.id}`);
    console.log(`[Import Start] DEBUG: jobData keys = ${Object.keys(jobData).join(', ')}`);
    
    try {
      await jobRef.set(jobData);
      console.log(`[Import Start] ✅ Job SUCCESSFULLY created: ${jobId}`);
      
      // Verify write
      const verifyDoc = await jobRef.get();
      if (verifyDoc.exists) {
        console.log(`[Import Start] ✅ VERIFIED: Job exists in Firestore, status=${verifyDoc.data()?.status}`);
      } else {
        console.error(`[Import Start] ❌ ERROR: Job written but CANNOT be read back!`);
      }
    } catch (writeError: any) {
      console.error(`[Import Start] ❌ FIRESTORE WRITE ERROR: ${writeError.message}`, writeError);
      throw writeError;
    }

    console.log(`[Import Start] Starting processor immediately in background...`);

    // Uruchom processor NATYCHMIAST w tle (nie czekaj na cron)
    setImmediate(() => {
      processImportJob(jobId, type, maxItemsPerSubcategory, importerType).catch((e) => {
        console.error(`[Import Start] Background processor failed for job ${jobId}:`, e);
        // Update job status to failed
        jobRef.update({
          status: 'failed',
          error: e.message,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).catch(console.error);
      });
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'queued',
      importerType,
      totalBatches: batches.length,
      message: `Import started using ${importerType}. Processing ${batches.length} subcategories with max ${maxItemsPerSubcategory} items each.`,
    }, { status: 202 }); // Accepted
  } catch (error: any) {
    console.error('[Import Start] Error:', error);
    return NextResponse.json({
      error: error.message,
      success: false,
    }, { status: 500 });
  }
}

/**
 * Background processor - przetwórz job batch po batchu
 * Używa nowego 5-etapowego systemu: Fetch → Dedupe → Enrich → Translate → Save
 */
export async function processImportJob(
  jobId: string, 
  type: 'products' | 'deals', 
  maxItemsPerSubcategory: number,
  importerType: 'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct' = 'keyword-search'
) {
  const jobRef = adminDb.collection('import_jobs').doc(jobId);
  
  try {
    console.log(`[Import Processor] Starting job ${jobId} (type: ${type})`);
    
    // Update status to running
    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const jobSnap = await jobRef.get();
    const jobData = jobSnap.data();
    if (!jobData) throw new Error('Job not found');

    const batches = jobData.batches || [];
    let currentIndex = jobData.progress?.current || 0;

    console.log(`[Import Processor] Processing ${batches.length} batches, starting from index ${currentIndex}`);

    // Get currency rate preference
    let currencyRate = 4.0; // Default USD to PLN rate
    try {
      const configDoc = await adminDb.collection('config').doc('importSettings').get();
      if (configDoc.exists) {
        currencyRate = configDoc.data()?.currencyRate || 4.0;
      }
    } catch (_) {}

    // Importuj tylko dla produktów (deals będą później)
    if (type !== 'products') {
      console.log(`[Import Processor] Skipping type "${type}" - use new modular system manually`);
      await jobRef.update({
        status: 'completed',
        'progress.completed': batches.length,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    // Import 5-stage pipeline
      // NEW: Add timeout wrapper for import
      let runProductImportPipeline: any = null;
      try {
        console.log(`[Import Processor] Loading import pipeline (timeout: 30s)...`);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Import pipeline loading timeout (30s)')), 30000)
        );
        const importPromise = import('@/ai/flows/importerFlow');
        const moduleOrTimeout = await Promise.race([importPromise, timeoutPromise]) as any;
        runProductImportPipeline = moduleOrTimeout.runProductImportPipeline;
      
        if (!runProductImportPipeline) {
          throw new Error('runProductImportPipeline not exported from module');
        }
        console.log(`[Import Processor] ✅ Pipeline loaded successfully`);
      } catch (importError: any) {
        console.error(`[Import Processor] ❌ Failed to load import pipeline:`, importError.message);
        await jobRef.update({
          status: 'failed',
          error: `Failed to load import pipeline: ${importError.message}`,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        throw importError;
      }

    // Heartbeat: update job.updatedAt every 5s so UI sees live activity
    const heartbeat = setInterval(async () => {
      try {
        await jobRef.update({ updatedAt: new Date().toISOString() });
      } catch {}
    }, 5000);

    for (let i = currentIndex; i < batches.length; i++) {
      // Check if paused or cancelled
      const currentJobSnap = await jobRef.get();
      const currentJobData = currentJobSnap.data();
      
      if (currentJobData?.status === 'paused') {
        console.log(`[Import Processor] Job ${jobId} paused at batch ${i}`);
        await jobRef.update({
          'progress.current': i,
          updatedAt: new Date().toISOString(),
        });
        clearInterval(heartbeat);
        return; // Exit gracefully
      }
      
      if (currentJobData?.status === 'failed') {
        console.log(`[Import Processor] Job ${jobId} cancelled at batch ${i}`);
        clearInterval(heartbeat);
        return; // Exit - job was cancelled by user
      }

      // Update progress at loop entry so UI shows movement
      await jobRef.update({
        'progress.current': i,
        updatedAt: new Date().toISOString(),
      });

      const batch = batches[i];
      console.log(`[Import Processor] [${i + 1}/${batches.length}] Processing: ${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`);
      console.log(`[Import Processor] Importer Type: ${importerType}`);

      try {
        // Also update progress before running pipeline for visibility
        await jobRef.update({
          'progress.current': i,
          updatedAt: new Date().toISOString(),
        });
        // NEW: Prepare keywords or category IDs based on importer type
        let keywords: string[] = [];
        let aliexpressCategoryIds: string[] = [];
        
        if (importerType === 'hot-products') {
          // Hot Products mode: use AliExpress category IDs
          aliexpressCategoryIds = getAliExpressCategoryIds(
            batch.categorySlug,
            batch.subcategorySlug,
            batch.subsubcategorySlug
          );
          
          if (aliexpressCategoryIds.length === 0) {
            // No specific mapping - fetch general hot products (no category filter)
            // This will get popular products across all categories
            console.log(`[Import Processor] No AliExpress mapping for ${batch.categorySlug}/${batch.subcategorySlug}/${batch.subsubcategorySlug} - using GENERAL hot products`);
            keywords = []; // Empty array = fetch hot products without category filter
          } else {
            // Use category IDs as "keywords" (stageFetch will detect hot-products mode)
            keywords = aliexpressCategoryIds;
            console.log(`[Import Processor] Using AliExpress category IDs: ${keywords.join(', ')}`);
          }
        } else if (importerType === 'convertiser') {
          // Convertiser mode: use importKeywords or category slugs
          const importKeywords = getImportKeywordsFromStructure(
            batch.categorySlug,
            batch.subcategorySlug,
            batch.subsubcategorySlug
          );
          
          if (importKeywords && importKeywords.length > 0) {
            keywords = importKeywords;
            console.log(`[Import Processor] Using Convertiser keywords: ${keywords.join(', ')}`);
          } else {
            // Fallback to slug-based keywords for Convertiser
            console.warn(`[Import Processor] No importKeywords for Convertiser ${batch.subsubcategorySlug} - using slug fallback`);
            keywords = [
              batch.subsubcategorySlug,
              batch.subcategorySlug,
              `${batch.subsubcategorySlug} popular`,
            ].filter(k => k && k.trim());
          }
        } else {
          // Keyword Search mode (original)
          // Try to get importKeywords from category structure first
          const importKeywords = getImportKeywordsFromStructure(
            batch.categorySlug,
            batch.subcategorySlug,
            batch.subsubcategorySlug
          );
          
          if (importKeywords && importKeywords.length > 0) {
            // Use predefined keywords from category-structure.ts
            keywords = importKeywords;
            console.log(`[Import Processor] Using predefined keywords: ${keywords.join(', ')}`);
          } else {
            // Fallback to slug-based keywords if no importKeywords defined
            console.warn(`[Import Processor] No importKeywords for ${batch.subsubcategorySlug} - using slug fallback`);
            keywords = [
              batch.subsubcategorySlug,
              batch.subcategorySlug,
              `${batch.subsubcategorySlug} ${batch.subcategorySlug}`,
              `${batch.subsubcategorySlug} popular`,
              `${batch.subsubcategorySlug} bestseller`,
            ].filter(k => k && k.trim());
          }
        }

        // Run 5-stage pipeline
        const pipelineResult = await runProductImportPipeline({
          jobId,
          keywords,
          maxProducts: maxItemsPerSubcategory,
          categoryPath: [batch.categoryName, batch.subcategoryName, batch.subsubcategoryName],
          categorySlugEN: batch.categorySlug,
          subcategorySlugEN: batch.subcategorySlug,
          subsubcategorySlugEN: batch.subsubcategorySlug,
          translateToPolish: true,
          currencyRate,
          importerType, // NEW: pass importer type
          aliexpressCategoryIds, // NEW: pass category IDs
          // OPTIMIZED: Faster, iterative processing with reduced delays
          fetch: { batchSize: 50, delayBetweenItems: 100, delayBetweenBatches: 500 },
          // RELAXED: Accept ALL products - no rating/orders filtering
          dedupe: { batchSize: 50, minRating: 0, minOrders: 0, minPrice: 1 },
          enrich: { batchSize: 5, delayBetweenItems: 200, delayBetweenBatches: 1000 },
          translate: { batchSize: 10, delayBetweenItems: 30, delayBetweenBatches: 200 },
          save: { batchSize: 5, skipExisting: false },
            });        const logEntry = {
          timestamp: new Date().toISOString(),
          batchIndex: i,
          subcategory: `${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`,
          status: 'success',
          stages: {
            fetched: pipelineResult.fetched.length,
            deduplicated: pipelineResult.deduplicated.length,
            enriched: pipelineResult.enriched.length,
            translated: pipelineResult.translated.length,
            saved: pipelineResult.saved.created.length + pipelineResult.saved.updated.length,
          },
          itemsAdded: pipelineResult.saved.created.length,
          itemsUpdated: pipelineResult.saved.updated.length,
          itemsSkipped: pipelineResult.saved.skipped.length,
          timeMs: pipelineResult.totalTime,
        };

        await jobRef.update({
          'progress.completed': (jobData.progress?.completed || 0) + 1,
          'progress.current': i + 1,
          logs: FieldValue.arrayUnion(logEntry),
          updatedAt: new Date().toISOString(),
        });

        console.log(`[Import Processor] [${i + 1}/${batches.length}] ✓ Pipeline completed in ${(pipelineResult.totalTime / 1000).toFixed(1)}s`);
        console.log(`  📊 Fetched: ${pipelineResult.fetched.length}, Deduped: ${pipelineResult.deduplicated.length}, Enriched: ${pipelineResult.enriched.length}, Translated: ${pipelineResult.translated.length}`);
        console.log(`  💾 Saved: ${pipelineResult.saved.created.length} created, ${pipelineResult.saved.updated.length} updated, ${pipelineResult.saved.skipped.length} skipped`);
      } catch (e: any) {
        console.error(`[Import Processor] [${i + 1}/${batches.length}] ✗ Error:`, e.message);

        const logEntry = {
          timestamp: new Date().toISOString(),
          batchIndex: i,
          subcategory: `${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`,
          status: 'error',
          error: e.message,
        };

        await jobRef.update({
          'progress.failed': (jobData.progress?.failed || 0) + 1,
          'progress.current': i + 1,
          logs: FieldValue.arrayUnion(logEntry),
          updatedAt: new Date().toISOString(),
        });
      }

      // Sleep 3s between batches to avoid rate limits and accumulate token time
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Mark as completed
    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    clearInterval(heartbeat);
    console.log(`[Import Processor] Job ${jobId} completed successfully`);
  } catch (error: any) {
    console.error(`[Import Processor] Job ${jobId} failed:`, error);
    await jobRef.update({
      status: 'failed',
      error: error.message,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}
