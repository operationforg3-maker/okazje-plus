import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Simple test batches
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
  progress: { total: 2, completed: 0, failed: 0, current: 0 },
  batches,
  maxItemsPerSubcategory: 100,
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
console.log(`🌍 Production import job created!`);
console.log(`📦 Batches: 2 (Smartphones, Laptops)`);
console.log(`🎯 Importer: keyword-search (AliExpress)`);
