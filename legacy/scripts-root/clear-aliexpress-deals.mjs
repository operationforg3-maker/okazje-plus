#!/usr/bin/env node
/**
 * Czyści deale ze źródła AliExpress z bazy
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'serviceAccountKey.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = getFirestore();

async function clearDeals() {
  console.log('🧹 Usuwam stare deale z AliExpress...\n');

  const dealsRef = db.collection('deals');
  const snapshot = await dealsRef.where('source', '==', 'aliexpress').get();

  console.log(`📊 Znaleziono ${snapshot.size} deali do usunięcia\n`);

  if (snapshot.empty) {
    console.log('✅ Brak deali do usunięcia');
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  
  console.log('✅ Usunięto wszystkie deale z AliExpress!');
}

clearDeals().catch(console.error);
