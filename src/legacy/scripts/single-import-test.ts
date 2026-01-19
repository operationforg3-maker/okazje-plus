import 'tsconfig-paths/register';
import { adminDb } from '@/lib/firebase-admin';

async function createSingleJob(){
  const jobRef = adminDb.collection('import_jobs').doc();
  const jobId = jobRef.id;
  const now = new Date().toISOString();
  const batch = {
    categoryId: 'elektronika',
    categoryName: 'Electronics',
    categorySlug: 'elektronika',
    subcategoryId: 'smartfony-telefony',
    subcategoryName: 'Smartphones',
    subcategorySlug: 'smartfony-telefony',
    subsubcategoryId: 'smartfony',
    subsubcategoryName: 'Smartphones',
    subsubcategorySlug: 'smartfony',
  };
  await jobRef.set({
    id: jobId,
    type: 'products',
    importerType: 'keyword-search',
    sources: ['keyword-search'],
    status: 'queued',
    progress: { total: 1, completed: 0, failed: 0, current: 0 },
    batches: [batch],
    maxItemsPerSubcategory: 5,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    logs: [],
    itemsCreated: [],
    itemsUpdated: [],
  });
  console.log(`✨ Created single import job: ${jobId}`);
  return jobId;
}

async function run(jobId: string){
  const { processImportJob } = await import('@/app/api/admin/import/start/route');
  console.log('🚀 Starting processor...');
  await processImportJob(jobId, 'products', 5, 'keyword-search');
  const doc = await adminDb.collection('import_jobs').doc(jobId).get();
  console.log(`✅ Job status: ${doc.data()?.status}`);
}

async function summary(){
  const cores = await adminDb.collection('product_cores').orderBy('updatedAt','desc').limit(1).get();
  if(cores.empty){ console.log('❌ No ProductCore found'); return; }
  const c = cores.docs[0]; const p:any = c.data();
  const title = typeof p.title === 'object' ? (p.title.pl || p.title.en || p.title.de) : p.title;
  console.log(`\n📦 Latest ProductCore: ${c.id}`);
  console.log(`  • Title: ${title}`);
  console.log(`  • Images: ${Array.isArray(p.images)? p.images.length : 0}`);
  console.log(`  • BestPrice: ${p.bestPrice?.amount ?? '—'} ${p.bestPrice?.currency ?? ''}`);
  console.log(`  • Description[PL]: ${p.description?.pl || p.shortDescription?.pl || '—'}`);
  console.log(`  • Description[EN]: ${p.description?.en || p.shortDescription?.en || '—'}`);
  const deals = await adminDb.collection('deals').where('productCoreId','==', c.id).limit(3).get();
  console.log(`  • Linked deals: ${deals.size}`);
}

(async () => {
  const jobId = await createSingleJob();
  await run(jobId);
  await summary();
})();
