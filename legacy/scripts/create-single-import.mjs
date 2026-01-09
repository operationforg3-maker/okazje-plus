import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Single batch: Electronics → Smartphones → Smartphones (PL slugs in docs)
const batch = {
  categoryName: 'Electronics',
  categorySlug: 'elektronika',
  subcategoryName: 'Smartphones',
  subcategorySlug: 'smartfony-telefony',
  subsubcategoryName: 'Smartphones',
  subsubcategorySlug: 'smartfony',
  categoryId: 'elektronika',
  subcategoryId: 'smartfony-telefony',
  subsubcategoryId: 'smartfony',
};

const jobRef = db.collection('import_jobs').doc();
const jobId = jobRef.id;
const now = new Date().toISOString();

const jobData = {
  id: jobId,
  type: 'products',
  importerType: 'keyword-search',
  sources: ['keyword-search'],
  status: 'queued',
  progress: { total: 1, completed: 0, failed: 0, current: 0 },
  batches: [batch],
  maxItemsPerSubcategory: 10,
  createdAt: now,
  updatedAt: now,
  startedAt: now,
  completedAt: null,
  logs: [],
  itemsCreated: [],
  itemsUpdated: [],
};

await jobRef.set(jobData);
console.log(`✨ Single Import Job ID: ${jobId}`);
console.log(`📦 Batches: 1 (Smartphones)`);
console.log(`🎯 Importer: keyword-search (AliExpress)`);
