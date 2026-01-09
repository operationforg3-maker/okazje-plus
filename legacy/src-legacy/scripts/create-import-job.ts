import { adminDb, adminAuth, FieldValue } from '@/lib/firebase-admin';

async function createImportJob() {
  console.log('📝 Tworzę import job...');
  
  const jobRef = adminDb.collection('import_jobs').doc();
  const jobId = jobRef.id;
  
  const now = new Date().toISOString();
  
  await jobRef.set({
    id: jobId,
    type: 'products',
    importerType: 'hot-products',
    status: 'queued',
    maxItemsPerSubcategory: 5,
    progress: {
      total: 0,
      completed: 0,
      failed: 0,
      current: 0
    },
    logs: [],
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    sources: ['hot-products'],
    batches: [],
    itemsCreated: [],
    itemsUpdated: []
  });
  
  console.log('✅ Job utworzony!');
  console.log('📌 Job ID:', jobId);
  console.log('🔗 URL:', `https://console.firebase.google.com/project/okazje-plus-project/firestore/databases/(default)/documents/import_jobs/${jobId}`);
  console.log('');
  console.log('⏱️  Cloud Function uruchomi się automatycznie w ciągu 30 sekund...');
  console.log('📊 Monitoruj: https://console.firebase.google.com/project/okazje-plus-project/firestore');
}

createImportJob().catch(console.error);
