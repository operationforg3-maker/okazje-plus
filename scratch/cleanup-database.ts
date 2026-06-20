import 'dotenv/config';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// CLI flags
const APPLY = process.argv.includes('--apply');
const FORCE_ALL = process.argv.includes('--force-all');
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 10000);

async function main() {
  // 1. Initialize Firebase Admin
  if (!getApps().length) {
    const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
      console.log('🔑 Using local serviceAccountKey.json');
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      console.log('☁️ Using environment credentials');
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'okazje-plus'
      });
    }
  }

  const db = getFirestore();

  if (FORCE_ALL) {
    console.log('\n⚠️ ⚠️ ⚠️  DANGER ZONE: FORCE-ALL MODE ENABLED ⚠️ ⚠️ ⚠️');
    console.log('This will completely wipe deals, product_cores, identity_matches, and harvester_jobs collections.');
    if (!APPLY) {
      console.log('🔍 DRY RUN - No records will be deleted. Run with --apply to execute.');
    } else {
      console.log('🔥 Executing complete database wipe...');
    }

    const collections = ['deals', 'product_cores', 'identity_matches', 'harvester_jobs', 'products'];
    for (const coll of collections) {
      let deleted = 0;
      const ref = db.collection(coll);
      
      while (true) {
        const snap = await ref.limit(250).get();
        if (snap.empty) break;

        if (APPLY) {
          const batch = db.batch();
          snap.docs.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
        deleted += snap.size;
      }
      console.log(`🧹 Collection '${coll}': ${APPLY ? 'Deleted' : 'Would delete'} ${deleted} documents`);
    }

    console.log('\n✨ Force-all cleanup complete.');
    process.exit(0);
  }

  console.log('\n🔍 Starting Database Integrity Audit & Cleanup...');
  console.log(`Mode: ${APPLY ? '🔥 EXECUTE (Deletions will be applied)' : '🔍 DRY RUN (Preview only)'}`);
  console.log(`Scanning limit: ${LIMIT} documents\n`);

  // Step 2: Fetch all ProductCores and Deals
  console.log('📥 Loading collections...');
  const productsSnap = await db.collection('product_cores').limit(LIMIT).get();
  const dealsSnap = await db.collection('deals').limit(LIMIT).get();
  const legacyProductsSnap = await db.collection('products').limit(LIMIT).get();

  console.log(`Loaded:`);
  console.log(`  - product_cores: ${productsSnap.size}`);
  console.log(`  - deals: ${dealsSnap.size}`);
  console.log(`  - legacy products: ${legacyProductsSnap.size}`);

  const productCoreIds = new Set(productsSnap.docs.map(doc => doc.id));
  const dealProductIds = new Set(dealsSnap.docs.map(doc => doc.data().productId || doc.data().productCoreId).filter(Boolean));

  const dealsToDelete: typeof dealsSnap.docs = [];
  const productsToDelete: typeof productsSnap.docs = [];
  const legacyProductsToDelete = legacyProductsSnap.docs;

  // Step 3: Analyze Deals
  for (const dealDoc of dealsSnap.docs) {
    const data = dealDoc.data();
    const dealId = dealDoc.id;
    const parentId = data.productId || data.productCoreId;

    let isIncomplete = false;
    let reason = '';

    if (!parentId) {
      isIncomplete = true;
      reason = 'Missing parent productId/productCoreId reference';
    } else if (!productCoreIds.has(parentId)) {
      isIncomplete = true;
      reason = `Referenced product_core ID '${parentId}' does not exist`;
    } else if (!data.price || typeof data.price.amount !== 'number' || data.price.amount <= 0) {
      isIncomplete = true;
      reason = 'Price is missing or <= 0';
    } else if (!data.affiliateUrl && !data.affiliateLink && !data.dealUrl) {
      isIncomplete = true;
      reason = 'Affiliate URL / link is missing';
    } else if (!data.title || (!data.title.pl && !data.title.en)) {
      isIncomplete = true;
      reason = 'Title is missing or empty in both pl and en';
    } else if (!data.image && (!data.images || data.images.length === 0)) {
      isIncomplete = true;
      reason = 'Product image and gallery are missing';
    } else if (data.shipping && (typeof data.shipping.timeDays !== 'number' || data.shipping.timeDays < 0)) {
      isIncomplete = true;
      reason = 'Shipping delivery days value is invalid';
    }

    if (isIncomplete) {
      dealsToDelete.push(dealDoc);
      console.log(`  ❌ Incomplete Deal [${dealId}] -> Reason: ${reason} (Title: "${data.title?.pl || data.title?.en || 'N/A'}")`);
    }
  }

  // Step 4: Analyze ProductCores
  for (const prodDoc of productsSnap.docs) {
    const data = prodDoc.data();
    const prodId = prodDoc.id;

    let isIncomplete = false;
    let reason = '';

    if (!data.title || (!data.title.pl && !data.title.en)) {
      isIncomplete = true;
      reason = 'Title is missing or empty in both pl and en';
    } else if (!data.imageUrl && (!data.images || data.images.length === 0)) {
      isIncomplete = true;
      reason = 'Product image and gallery are missing';
    } else if (!data.bestPrice || typeof data.bestPrice.amount !== 'number' || data.bestPrice.amount <= 0) {
      isIncomplete = true;
      reason = 'bestPrice is missing or <= 0';
    } else if (!dealProductIds.has(prodId)) {
      isIncomplete = true;
      reason = 'Orphan product (has 0 deals associated with it)';
    } else if (!data.mainCategorySlug || !data.subCategorySlug) {
      isIncomplete = true;
      reason = 'Category taxonomy slugs are missing';
    }

    if (isIncomplete) {
      productsToDelete.push(prodDoc);
      console.log(`  ❌ Incomplete ProductCore [${prodId}] -> Reason: ${reason} (Title: "${data.title?.pl || data.title?.en || 'N/A'}")`);
    }
  }

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  console.log(`Deals to delete: ${dealsToDelete.length}/${dealsSnap.size}`);
  console.log(`ProductCores to delete: ${productsToDelete.length}/${productsSnap.size}`);
  console.log(`Legacy products to delete: ${legacyProductsToDelete.length}/${legacyProductsSnap.size}`);

  // Step 5: Execute Deletions
  if (APPLY) {
    console.log('\n🧹 Applying deletions in Firestore...');

    const deleteBatches = async (docs: any[], label: string) => {
      if (docs.length === 0) return;
      console.log(`  Deleting ${docs.length} items from ${label}...`);
      const batchSize = 250;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        const slice = docs.slice(i, i + batchSize);
        slice.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      console.log(`  ✓ Finished deleting from ${label}`);
    };

    await deleteBatches(dealsToDelete, 'deals');
    await deleteBatches(productsToDelete, 'product_cores');
    await deleteBatches(legacyProductsToDelete, 'legacy products');

    console.log('\n✨ Database cleanup execution finished.');
  } else {
    console.log('\n🔍 Dry run completed. No documents were deleted.');
    console.log('💡 Run with --apply flag to execute the cleanup.');
    console.log('💡 Run with --force-all --apply to perform a complete database reset.');
  }
}

main().catch((err) => {
  console.error('❌ Fatal cleanup error:', err);
  process.exit(1);
});
