import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firebase-admin';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';

/**
 * Uruchamia import produktów/okazji w trybie batch
 * POST /api/admin/import/start
 * Body: { type: 'products' | 'deals', maxItemsPerSubcategory: 10 }
 * Returns: { jobId: string, status: 'queued', totalBatches: number }
 */
export async function POST(req: NextRequest) {
  try {
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
 */
export async function processImportJob(jobId: string, type: 'products' | 'deals', maxItemsPerSubcategory: number) {
  const jobRef = adminDb.collection('import_jobs').doc(jobId);
  
  try {
    console.log(`[Import Processor] Starting job ${jobId}`);
    
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

    // Import function
    const importFunc = type === 'products' 
      ? (await import('@/ai/flows/fillSubSubcategoryProducts')).fillSubSubcategoryProducts
      : (await import('@/ai/flows/fillSubSubcategoryDeals')).fillSubSubcategoryDeals;

    if (!importFunc) {
      throw new Error(`Import function not available for type: ${type}`);
    }

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
        // Get currency preference
        let preferredCurrency = 'USD';
        try {
          const currencyDoc = await adminDb.collection('config').doc('currencyPreference').get();
          if (currencyDoc.exists) {
            preferredCurrency = currencyDoc.data()?.currency || 'USD';
          }
        } catch (_) {}

        const result = await importFunc({
          ...batch,
          preferredCurrency,
          maxProducts: type === 'products' ? maxItemsPerSubcategory : undefined,
          maxDeals: type === 'deals' ? maxItemsPerSubcategory : undefined,
          jobId, // Pass jobId for tracking
        });

        // Log success
        const itemsAddedKey = type === 'products' ? 'productsAdded' : 'dealsAdded';
        const itemsUpdatedKey = type === 'products' ? 'productsUpdated' : 'dealsUpdated';
        
        const logEntry = {
          timestamp: new Date().toISOString(),
          batchIndex: i,
          subcategory: `${batch.categoryName}/${batch.subcategoryName}/${batch.subsubcategoryName}`,
          status: 'success',
          itemsAdded: result[itemsAddedKey] || 0,
          itemsUpdated: result[itemsUpdatedKey] || 0,
        };

        await jobRef.update({
          'progress.completed': (jobData.progress?.completed || 0) + 1,
          'progress.current': i + 1,
          logs: FieldValue.arrayUnion(logEntry),
          updatedAt: new Date().toISOString(),
        });

        console.log(`[Import Processor] [${i + 1}/${batches.length}] ✓ Success: ${result[itemsAddedKey]} added, ${result[itemsUpdatedKey]} updated`);
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

      // Sleep 2s between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
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
