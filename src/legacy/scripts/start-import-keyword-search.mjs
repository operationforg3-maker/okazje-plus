import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Get all categories/subcategories for batches
const categories = await db.collection('categories').get();
const batches = [];

console.log('🔄 Building batches from categories...\n');

for (const catDoc of categories.docs) {
  const cat = catDoc.data();
  const subs = await catDoc.ref.collection('subcategories').get();
  
  for (const subDoc of subs.docs) {
    const sub = subDoc.data();
    const subsubs = await subDoc.ref.collection('subcategories').get();
    
    for (const subsubDoc of subsubs.docs) {
      const subsub = subsubDoc.data();
      batches.push({
        categoryId: catDoc.id,
        categoryName: cat.name,
        categorySlug: cat.slug,
        subcategoryId: subDoc.id,
        subcategoryName: sub.name,
        subcategorySlug: sub.slug,
        subsubcategoryId: subsubDoc.id,
        subsubcategoryName: subsub.name,
        subsubcategorySlug: subsub.slug,
      });
    }
  }
}

console.log(`✅ Created ${batches.length} batches\n`);

// Create job
const jobRef = db.collection('import_jobs').doc();
const jobId = jobRef.id;
const now = new Date().toISOString();

const jobData = {
  id: jobId,
  type: 'products',
  importerType: 'keyword-search',  // KEY CHANGE: Use AliExpress keyword search!
  sources: ['keyword-search'],
  status: 'queued',
  progress: {
    total: batches.length,
    completed: 0,
    failed: 0,
    current: 0,
  },
  batches,
  maxItemsPerSubcategory: 30,  // More products per category
  createdAt: now,
  updatedAt: now,
  startedAt: now,
  completedAt: null,
  logs: [],
  itemsCreated: [],
  itemsUpdated: [],
};

await jobRef.set(jobData);

console.log('✨ Import job created!');
console.log(`  Job ID: ${jobId}`);
console.log(`  Importer: keyword-search (AliExpress)`);
console.log(`  Batches: ${batches.length}`);
console.log(`  Max items per category: 30`);
console.log(`\n  To check progress: npm run check:latest-import`);

// Trigger processor
console.log(`\n🚀 Starting import processor...`);
const { processImportJob } = await import('./src/app/api/admin/import/start/route.ts');
processImportJob(jobId, 'products', 30, 'keyword-search')
  .then(() => console.log('✅ Processor completed'))
  .catch(err => console.error('❌ Processor error:', err));
