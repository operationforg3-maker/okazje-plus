import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Create simple batches with English keywords for AliExpress
const batches = [
  {
    categoryName: 'Electronics',
    categorySlug: 'elektronika',
    subcategoryName: 'Smartphones',
    subcategorySlug: 'smartfony-telefony',
    subsubcategoryName: 'Smartphones',
    subsubcategorySlug: 'smartfony',
    categoryId: 'elektronika',
    subcategoryId: 'smartfony-telefony',
    subsubcategoryId: 'smartfony',
  },
  {
    categoryName: 'Electronics',
    categorySlug: 'elektronika',
    subcategoryName: 'Computers',
    subcategorySlug: 'komputery',
    subsubcategoryName: 'Laptops',
    subsubcategorySlug: 'laptopy',
    categoryId: 'elektronika',
    subcategoryId: 'komputery',
    subsubcategoryId: 'laptopy',
  },
  {
    categoryName: 'Fashion',
    categorySlug: 'moda',
    subcategoryName: 'Womens Clothing',
    subcategorySlug: 'odziez-damska',
    subsubcategoryName: 'Dresses',
    subsubcategorySlug: 'sukienki',
    categoryId: 'moda',
    subcategoryId: 'odziez-damska',
    subsubcategoryId: 'sukienki',
  },
];

const jobRef = db.collection('import_jobs').doc();
const jobId = jobRef.id;
const now = new Date().toISOString();

const jobData = {
  id: jobId,
  type: 'products',
  importerType: 'keyword-search',
  sources: ['keyword-search'],
  status: 'queued',
  progress: { total: 3, completed: 0, failed: 0, current: 0 },
  batches,
  maxItemsPerSubcategory: 50,
  createdAt: now,
  updatedAt: now,
  startedAt: now,
  completedAt: null,
  logs: [],
  itemsCreated: [],
  itemsUpdated: [],
};

await jobRef.set(jobData);
console.log(`✨ Job ID: ${jobId}`);
console.log(`📦 Batches: 3 (Smartphones, Laptops, Dresses)`);
console.log(`🎯 Importer: keyword-search (AliExpress)`);
console.log(`\nChecking in 10s...`);

setTimeout(async () => {
  const check = await db.collection('import_jobs').doc(jobId).get();
  const data = check.data();
  console.log(`\nStatus: ${data.status}`);
  console.log(`Progress: ${data.progress.completed}/${data.progress.total}`);
  console.log(`Logs: ${data.logs?.length || 0}`);
  process.exit(0);
}, 10000);
