import { adminDb } from '@/lib/firebase-admin';
import { ensureProductCategory, matchCategoryByText } from '@/lib/category-mapper';

async function run() {
  const samples = [
    'Wireless Bluetooth Headphones ANC 40h',
    'USB-C Fast Charger 65W GaN',
    'Microphone USB Podcast Streaming',
    'Camera Tripod Aluminum Travel',
    'Soundbar Dolby Atmos 3.1',
  ];

  for (const title of samples) {
    const m = await matchCategoryByText(title);
    console.log(`🔎 "${title}" ->`, m);
  }

  // Create a temporary ProductCore and ensure category is set
  const title = 'Bluetooth Earbuds Wireless Headphones';
  const product = {
    identityHash: `tmp_${Date.now()}`,
    title: { pl: title, en: title, de: title },
    shortDescription: { pl: 'tmp', en: 'tmp', de: 'tmp' },
    fullDescription: { pl: '', en: '' },
    specs: {},
    mainCategorySlug: 'uncategorized',
    subCategorySlug: 'uncategorized',
    images: ['https://via.placeholder.com/600x400.png?text=Test'],
    primaryImageHash: 'tmp',
    reviewsSummary: { pl: '', en: '', de: '' },
    rating: { score: 0, count: 0, provider: 'mixed' },
    bestPrice: { amount: 0, currency: 'USD' },
    bestPriceCurrency: 'PLN',
    linkedDealIds: [],
    searchTags: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { source: 'test', importedAt: new Date().toISOString() },
  } as any;

  const ref = await adminDb.collection('product_cores').add(product);
  console.log('🧪 Created temp product:', ref.id);

  const matched = await ensureProductCategory(ref.id, title);
  console.log('📌 ensureProductCategory result:', matched);

  const snap = await ref.get();
  const data = snap.data() as any;
  console.log('🧾 Product category fields:', {
    mainCategorySlug: data?.mainCategorySlug,
    subCategorySlug: data?.subCategorySlug,
    subSubCategorySlug: data?.subSubCategorySlug,
  });

  // Cleanup temp doc
  await ref.delete();
  console.log('🧹 Temp product deleted');
}

run().catch(err => {
  console.error('❌ Test failed:', err);
  process.exitCode = 1;
});
