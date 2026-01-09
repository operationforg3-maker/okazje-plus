// Direct invoke of processImportJob via dynamic import
import { processImportJob } from './src/app/api/admin/import/start/route.ts';

const jobId = 'sqejGVfBGUcUs2XlTO4e';
console.log(`🚀 Triggering processor for job ${jobId}...`);

try {
  await processImportJob(jobId, 'products', 50, 'keyword-search');
  console.log('✅ Processor completed');
} catch (err) {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
}
