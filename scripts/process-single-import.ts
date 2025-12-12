import { processImportJob } from '@/app/api/admin/import/start/route';

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error('Usage: process-single-import <jobId> [maxItemsPerSubcategory] [importerType]');
    process.exit(1);
  }

  const maxItems = process.argv[3] ? Number(process.argv[3]) : 3;
  const importerType = (process.argv[4] as any) || 'keyword-search';

  try {
    await processImportJob(jobId, 'products', maxItems, importerType);
    console.log(`Job ${jobId} processed.`);
  } catch (err) {
    console.error('Processing failed:', err);
    process.exit(1);
  }
}

main();
