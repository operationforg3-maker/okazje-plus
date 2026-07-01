/**
 * cleanup-orphan-refiner-jobs.ts
 *
 * Jednorazowy skrypt usuwający osierocone dokumenty z kolekcji refiner_jobs i import_jobs.
 * Dokumenty te nagromadziły się (~4500+) bo stary endpoint /wipe nie czyścił tych kolekcji.
 *
 * Użycie (dry-run):
 *   npx ts-node -r tsconfig-paths/register scratch/cleanup-orphan-refiner-jobs.ts
 *
 * Użycie (apply):
 *   npx ts-node -r tsconfig-paths/register scratch/cleanup-orphan-refiner-jobs.ts --apply
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 100; // Zmniejszono z 400 — import_jobs mają duże payloady (nested logs)

async function deleteCollection(db: FirebaseFirestore.Firestore, collectionName: string): Promise<number> {
  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    const snapshot = await db.collection(collectionName).limit(BATCH_SIZE).get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    if (APPLY) {
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    totalDeleted += snapshot.docs.length;
    process.stdout.write(`\r  ${collectionName}: usunięto ${totalDeleted} dokumentów...`);
  }

  process.stdout.write('\n');
  return totalDeleted;
}

async function main() {
  // Initialize Firebase Admin
  if (!getApps().length) {
    const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      console.log('🔑 Using local serviceAccountKey.json');
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      console.log('☁️  Using environment credentials');
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'okazje-plus',
      });
    }
  }

  const db = getFirestore();

  const collectionsToClean = ['refiner_jobs', 'import_jobs'];

  // Count before
  console.log('\n📊 Liczenie dokumentów przed czyszczeniem...');
  for (const col of collectionsToClean) {
    const snap = await db.collection(col).count().get();
    console.log(`  ${col}: ${snap.data().count} dokumentów`);
  }

  if (!APPLY) {
    console.log('\n🔍 DRY RUN — żadne dokumenty nie zostały usunięte.');
    console.log('💡 Uruchom z flagą --apply żeby faktycznie usunąć:\n');
    console.log('   npx ts-node -r tsconfig-paths/register scratch/cleanup-orphan-refiner-jobs.ts --apply\n');
    return;
  }

  console.log('\n🗑️  Usuwanie osieroconych dokumentów...\n');
  const results: Record<string, number> = {};

  for (const col of collectionsToClean) {
    results[col] = await deleteCollection(db, col);
  }

  const total = Object.values(results).reduce((s, n) => s + n, 0);

  console.log('\n✅ Czyszczenie zakończone!');
  console.log('Podsumowanie:');
  for (const [col, count] of Object.entries(results)) {
    console.log(`  ${col}: ${count} usuniętych`);
  }
  console.log(`  RAZEM: ${total} dokumentów\n`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
