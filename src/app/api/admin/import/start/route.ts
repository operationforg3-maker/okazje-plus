import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, FieldValue } from '@/lib/firebase-admin';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';

/**
 * Uruchamia import produktów/okazji w trybie batch
 * POST /api/admin/import/start
 * Body: { type: 'products' | 'deals', maxItemsPerSubcategory: 10 }
 * Returns: { jobId: string, status: 'queued', totalBatches: number }
 */
export async function POST(req: NextRequest) {
  try {
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

    const { type = 'products', maxItemsPerSubcategory = 10 } = await req.json();

    if (!['products', 'deals'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type. Use "products" or "deals"' }, { status: 400 });
    }

    console.log(`[Import Start] Type: ${type}, Max items per subcategory: ${maxItemsPerSubcategory}`);

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

    await jobRef.set({
      id: jobId,
      type,
      status: 'queued', // queued | running | paused | completed | failed
      progress: {
        total: batches.length,
        completed: 0,
        failed: 0,
        current: 0,
      },
      batches,
      maxItemsPerSubcategory,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      logs: [],
      itemsCreated: [], // Track IDs for rollback
      itemsUpdated: [], // Track IDs for rollback
    });

    console.log(`[Import Start] Job created: ${jobId}`);

    // Uruchom processor w tle (nie czekaj)
    processImportJob(jobId, type, maxItemsPerSubcategory).catch((e) => {
      console.error(`[Import Start] Background processor failed for job ${jobId}:`, e);
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'queued',
      totalBatches: batches.length,
      message: `Import started. Processing ${batches.length} subcategories with max ${maxItemsPerSubcategory} items each.`,
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
export async function processImportJob(jobId: string, type: 'products' | 'deals', maxItemsPerSubcategory: number) {
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
    const { runProductImportPipeline } = await import('@/ai/flows/importerFlow');

    for (let i = currentIndex; i < batches.length; i++) {
      // Check if paused
      const currentJobSnap = await jobRef.get();
      const currentJobData = currentJobSnap.data();
      if (currentJobData?.status === 'paused') {
        console.log(`[Import Processor] Job ${jobId} paused at batch ${i}`);
        await jobRef.update({
          'progress.current': i,
          updatedAt: new Date().toISOString(),
        });
        return; // Exit gracefully
      }

      const batch = batches[i];
      console.log(`[Import Processor] [${i + 1}/${batches.length}] Processing: ${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`);

      try {
        // Generate search keywords from ENGLISH category slugs (not Polish names!)
        // AliExpress API expects English keywords like 'electronics', 'smartphones', etc.
        const keywords = [
          batch.categorySlug,
          batch.subcategorySlug,
          batch.subsubcategorySlug,
          `${batch.subcategorySlug} ${batch.categorySlug}`,
          `${batch.subcategorySlug} popular`,
          `${batch.subcategorySlug} bestseller`,
        ].filter(k => k && k !== batch.subsubcategorySlug);

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
          fetch: { batchSize: 50, delayBetweenItems: 200, delayBetweenBatches: 1000 },
          dedupe: { batchSize: 50, minRating: 2.5, minOrders: 10 },
          enrich: { batchSize: 5, delayBetweenItems: 300, delayBetweenBatches: 2000 },
          translate: { batchSize: 10, delayBetweenItems: 50, delayBetweenBatches: 300 },
          save: { batchSize: 5, skipExisting: true },
        });

        const logEntry = {
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
