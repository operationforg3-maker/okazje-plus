import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!getFirestore) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

async function createTestJob() {
  const jobData = {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'queued',
    importer: 'keyword-search',
    batches: [
      {
        categoryName: 'Elektronika',
        categorySlug: 'electronics',
        subcategoryName: 'Smartfony i telefony',
        subcategorySlug: 'phones',
        subsubcategoryName: 'Smartfony',
        subsubcategorySlug: 'smartphones',
        keywords: ['smartphone', 'mobile phone']
      }
    ],
    settings: {
      maxItemsPerSubcategory: 10,
      importerType: 'keyword-search',
      translateToPolish: true,
      currencyTarget: 'PLN',
    },
    logs: [],
    progress: { current: 0, total: 1 }
  };
  
  const ref = await db.collection('import_jobs').add(jobData);
  console.log('✅ Created test job:', ref.id);
  console.log('Category: Elektronika/Smartfony i telefony/Smartfony');
  console.log('\nWait ~2 minutes for processing, then check products:');
  console.log('node check-new-job.mjs', ref.id);
  
  process.exit(0);
}

createTestJob().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
