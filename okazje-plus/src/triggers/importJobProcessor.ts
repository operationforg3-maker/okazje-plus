import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { runProductImportPipeline } from '../../ai/flows/importerFlow';

const db = admin.firestore();

/**
 * Cloud Function Trigger: Process Import Jobs
 * Fires when a new import job is created with status='queued'
 * Processes batches and updates job status
 */
export const processImportJob = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '2GB',
  })
  .firestore
  .document('import_jobs/{jobId}')
  .onCreate(async (snap, context) => {
    const jobId = context.params.jobId;
    const jobData = snap.data();

    if (!jobData || jobData.status !== 'queued') {
      console.log(`[Import Trigger] Job ${jobId} not queued, skipping`);
      return null;
    }

    console.log(`[Import Trigger] Starting job ${jobId}`);

    const jobRef = db.collection('import_jobs').doc(jobId);

    try {
      // Update to running
      await jobRef.update({
        status: 'running',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const batches = jobData.batches || [];
      const maxItemsPerSubcategory = jobData.maxItemsPerSubcategory || 10;
      const importerType = jobData.importerType || 'keyword-search';
      const type = jobData.type || 'products';

      if (type !== 'products') {
        console.log(`[Import Trigger] Skipping type "${type}"`);
        await jobRef.update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
      }

      // Process batches
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        console.log(`[Import Trigger] [${i + 1}/${batches.length}] Processing: ${batch.subsubcategoryName}`);

        try {
          // Prepare keywords based on importer type
          let keywords: string[] = [];
          
          if (importerType === 'convertiser') {
            keywords = [
              batch.subsubcategorySlug,
              batch.subcategorySlug,
              `${batch.subsubcategorySlug} popular`,
            ].filter(Boolean);
          } else {
            keywords = [
              batch.subsubcategorySlug,
              batch.subcategorySlug,
              `${batch.subsubcategorySlug} ${batch.subcategorySlug}`,
            ].filter(Boolean);
          }

          // Run import pipeline
          const pipelineResult = await runProductImportPipeline({
            jobId,
            keywords,
            maxProducts: maxItemsPerSubcategory,
            categoryPath: [batch.categoryName, batch.subcategoryName, batch.subsubcategoryName],
            categorySlugEN: batch.categorySlug,
            subcategorySlugEN: batch.subcategorySlug,
            subsubcategorySlugEN: batch.subsubcategorySlug,
            translateToPolish: true,
            currencyRate: 4.0,
            importerType,
            fetch: { batchSize: 50, delayBetweenItems: 100, delayBetweenBatches: 500 },
            dedupe: { batchSize: 50, minRating: 2.5, minOrders: 10 },
            enrich: { batchSize: 5, delayBetweenItems: 200, delayBetweenBatches: 1000 },
            translate: { batchSize: 10, delayBetweenItems: 30, delayBetweenBatches: 200 },
            save: { batchSize: 5, skipExisting: true },
          });

          await jobRef.update({
            'progress.completed': admin.firestore.FieldValue.increment(1),
            'progress.current': i + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            logs: admin.firestore.FieldValue.arrayUnion({
              timestamp: new Date().toISOString(),
              batchIndex: i,
              subcategory: batch.subsubcategoryName,
              status: 'success',
              itemsAdded: pipelineResult.saved.created.length,
              itemsUpdated: pipelineResult.saved.updated.length,
            }),
          });

          console.log(`[Import Trigger] [${i + 1}/${batches.length}] ✓ Done`);
        } catch (error: any) {
          console.error(`[Import Trigger] [${i + 1}/${batches.length}] Error:`, error.message);

          await jobRef.update({
            'progress.failed': admin.firestore.FieldValue.increment(1),
            'progress.current': i + 1,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            logs: admin.firestore.FieldValue.arrayUnion({
              timestamp: new Date().toISOString(),
              batchIndex: i,
              subcategory: batch.subsubcategoryName,
              status: 'error',
              error: error.message,
            }),
          });
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Mark as completed
      await jobRef.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[Import Trigger] Job ${jobId} completed`);
      return null;
    } catch (error: any) {
      console.error(`[Import Trigger] Job ${jobId} failed:`, error);

      await jobRef.update({
        status: 'failed',
        error: error.message,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    }
  });
