import { AIRefiner } from '@/lib/automation/refiner';

async function main() {
  const jobId = `refiner_manual_${Date.now()}`;
  const refiner = new AIRefiner(jobId);

  const result = await refiner.refineExistingProducts(
    undefined,
    200,
    'full_enrichment',
    false
  );

  console.log('Refiner job completed:', {
    id: result.id,
    status: result.status,
    processed: result.productsProcessed,
    success: result.productsSuccessful,
    failed: result.productsFailed,
  });
}

main().catch((error) => {
  console.error('Refiner job failed:', error);
  process.exit(1);
});
