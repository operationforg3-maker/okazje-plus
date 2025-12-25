import { adminDb } from '@/lib/firebase-admin';

async function diagnose() {
  console.log('🔍 Database Diagnostics\n');

  // Products
  const products = await adminDb.collection('product_cores').get();
  const productsApproved = await adminDb.collection('product_cores').where('status', '==', 'approved').get();
  const productsPending = await adminDb.collection('product_cores').where('status', '==', 'pending_approval').get();

  console.log('📦 Products (product_cores):');
  console.log(`   Total: ${products.size}`);
  console.log(`   Approved: ${productsApproved.size}`);
  console.log(`   Pending: ${productsPending.size}`);

  if (productsApproved.size > 0) {
    const sample = productsApproved.docs[0].data();
    console.log(`   Sample approved: ${sample.title.pl || sample.title} (${sample.mainCategorySlug}/${sample.subCategorySlug})`);
    console.log(`      Price: ${sample.bestPrice?.amount} ${sample.bestPrice?.currency}`);
    console.log(`      Rating: ${sample.rating?.score} (${sample.rating?.count} reviews)`);
  }

  // Deals
  const deals = await adminDb.collection('deals').get();
  const dealsApproved = await adminDb.collection('deals').where('status', '==', 'approved').get();

  console.log('\n🎁 Deals (deals):');
  console.log(`   Total: ${deals.size}`);
  console.log(`   Approved: ${dealsApproved.size}`);

  if (dealsApproved.size > 0) {
    const sample = dealsApproved.docs[0].data();
    console.log(`   Sample: ${sample.title} (${sample.source})`);
    console.log(`      Price: ${sample.price} PLN`);
    console.log(`      Merchant: ${sample.merchantName}`);
  }

  // Categories
  const categories = await adminDb.collection('categories').get();
  console.log(`\n🏷️ Categories: ${categories.size} main categories`);

  if (categories.size > 0) {
    const sample = categories.docs[0].data();
    console.log(`   Sample: ${sample.name} (${sample.slug})`);
    console.log(`      Translations: ${Object.keys(sample.translations || {}).join(', ')}`);

    // Sub-categories
    const subs = await adminDb.collection(`categories/${categories.docs[0].id}/subcategories`).get();
    console.log(`      Sub-categories: ${subs.size}`);
  }

  console.log('\n✅ Diagnostics complete\n');
}

diagnose()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });
