import { startRefinerJob } from '@/lib/automation/refiner';
import { adminDb } from '@/lib/firebase-admin';

async function main() {
  const productId = process.argv[2];
  if (!productId) {
    throw new Error('Usage: npm run run:refiner:single -- <productId>');
  }

  const job = await startRefinerJob([productId], 'full_enrichment');

  const productSnap = await adminDb.collection('product_cores').doc(productId).get();
  const product = productSnap.data() || {};

  const title = product.title || {};
  const shortDescription = product.shortDescription || {};
  const specs = product.specs || {};

  console.log(JSON.stringify({
    jobId: job.id,
    status: job.status,
    productsProcessed: job.productsProcessed,
    productsSuccessful: job.productsSuccessful,
    productsFailed: job.productsFailed,
    completedAt: job.completedAt,
    productPreview: {
      id: productId,
      updatedAt: product.updatedAt,
      title: {
        pl: title.pl,
        en: title.en,
      },
      shortDescription: {
        pl: shortDescription.pl,
        en: shortDescription.en,
      },
      specsCount: Object.keys(specs).length,
      specsSample: Object.entries(specs).slice(0, 8),
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
