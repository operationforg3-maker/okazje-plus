import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

config();
const envLocalPath = join(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

import * as admin from 'firebase-admin';
import { adminDb } from '../src/lib/firebase-admin';
import { generateEmbeddings } from '../src/ai/embeddings';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  if (dryRun) {
    console.log('=== DRY RUN MODE: No updates will be written to Firestore ===\n');
  }

  // Backfill Deals
  console.log('Fetching deals for embedding backfill...');
  const dealsSnap = await adminDb.collection('deals').get();
  const dealsToBackfill = dealsSnap.docs.filter((doc: any) => {
    const data = doc.data();
    const isVector = data.embedding && typeof data.embedding.toArray === 'function';
    return !isVector;
  });
  console.log(`Found ${dealsToBackfill.length} deals missing proper VectorValue embeddings.`);

  // Backfill Product Cores
  console.log('Fetching product cores for embedding backfill...');
  const productsSnap = await adminDb.collection('product_cores').get();
  const productsToBackfill = productsSnap.docs.filter((doc: any) => {
    const data = doc.data();
    const isVector = data.embedding && typeof data.embedding.toArray === 'function';
    return !isVector;
  });
  console.log(`Found ${productsToBackfill.length} product cores missing proper VectorValue embeddings.`);

  const total = dealsToBackfill.length + productsToBackfill.length;
  console.log(`\nTotal items to backfill/convert: ${total}`);

  if (total === 0) {
    console.log('All documents already have VectorValue embeddings. Nothing to do!');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  // Process Deals
  if (dealsToBackfill.length > 0) {
    console.log('\n--- BACKFILLING DEALS ---');
    for (let i = 0; i < dealsToBackfill.length; i++) {
      const doc = dealsToBackfill[i];
      const data = doc.data();
      const title = data.title?.pl || data.title?.en || data.title || '';
      const desc = data.description?.pl || data.description?.en || data.description || '';
      const text = `${title} ${desc}`.trim();

      console.log(`[Deals ${i + 1}/${dealsToBackfill.length}] ID: ${doc.id} - Text: "${title.substring(0, 50)}..."`);

      if (dryRun) {
        successCount++;
        continue;
      }

      try {
        let vector;
        if (data.embedding && Array.isArray(data.embedding) && data.embedding.length === 768) {
          console.log(`  Converting existing raw array to VectorValue...`);
          vector = admin.firestore.FieldValue.vector(data.embedding);
        } else if (text) {
          const embedding = await generateEmbeddings(text);
          vector = admin.firestore.FieldValue.vector(embedding);
        }

        if (vector) {
          await adminDb.collection('deals').doc(doc.id).update({ embedding: vector });
          console.log(`  ✅ Embedded & updated successfully`);
        } else {
          console.log(`  ⚠️ Skipped (empty title and description)`);
        }
        successCount++;
      } catch (err) {
        console.error(`  ❌ Failed:`, err);
        failCount++;
      }

      // Small throttling delay to be gentle
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // Process Product Cores
  if (productsToBackfill.length > 0) {
    console.log('\n--- BACKFILLING PRODUCT CORES ---');
    for (let i = 0; i < productsToBackfill.length; i++) {
      const doc = productsToBackfill[i];
      const data = doc.data();
      const title = data.title?.pl || data.title?.en || data.title || '';
      const desc = data.description?.pl || data.description?.en || data.description || '';
      const text = `${title} ${desc}`.trim();

      console.log(`[Product Cores ${i + 1}/${productsToBackfill.length}] ID: ${doc.id} - Text: "${title.substring(0, 50)}..."`);

      if (dryRun) {
        successCount++;
        continue;
      }

      try {
        let vector;
        if (data.embedding && Array.isArray(data.embedding) && data.embedding.length === 768) {
          console.log(`  Converting existing raw array to VectorValue...`);
          vector = admin.firestore.FieldValue.vector(data.embedding);
        } else if (text) {
          const embedding = await generateEmbeddings(text);
          vector = admin.firestore.FieldValue.vector(embedding);
        }

        if (vector) {
          await adminDb.collection('product_cores').doc(doc.id).update({ embedding: vector });
          console.log(`  ✅ Embedded & updated successfully`);
        } else {
          console.log(`  ⚠️ Skipped (empty title and description)`);
        }
        successCount++;
      } catch (err) {
        console.error(`  ❌ Failed:`, err);
        failCount++;
      }

      // Small throttling delay
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log(`\nBackfill complete. Success: ${successCount}, Failures: ${failCount}`);
}

main().catch(err => {
  console.error('Fatal error in backfill-embeddings script:', err);
  process.exit(1);
});
