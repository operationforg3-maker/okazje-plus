import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

function initAdmin(): FirebaseFirestore.Firestore {
  if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
      admin.initializeApp();
    } else {
      const serviceAccount = require('../serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
  }
  return admin.firestore();
}

function assertOrThrow(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const db = initAdmin();

  console.log('=== CANARY M6 MECHANISM CHECK ===');

  const runtimeSnap = await db.doc('admin_meta/aliexpress-autopilot-runtime').get();
  assertOrThrow(runtimeSnap.exists, 'Missing admin_meta/aliexpress-autopilot-runtime');

  const runtime = runtimeSnap.data() as Record<string, unknown>;
  const runtimeStatus = String(runtime.status || 'unknown');
  const runtimeError = String(runtime.error || '');
  const triggeredAt = String(runtime.triggeredAt || '');
  const runtimeAgeMs = Date.now() - Date.parse(triggeredAt);

  console.log(`runtime.status=${runtimeStatus}`);
  console.log(`runtime.error=${runtimeError || '(none)'}`);
  console.log(`runtime.age.min=${Math.round(runtimeAgeMs / 60000)}`);

  assertOrThrow(runtimeAgeMs < 60 * 60 * 1000, 'Runtime is stale (>60min).');
  assertOrThrow(!runtimeError.includes('status 401'), 'Autopilot still failing with HTTP 401.');

  const recentRunsSnap = await db
    .collection('aliexpress_autopilot_runs')
    .orderBy('triggeredAt', 'desc')
    .limit(40)
    .get();

  assertOrThrow(!recentRunsSnap.empty, 'No entries in aliexpress_autopilot_runs.');

  const seen = new Map<string, number>();
  for (const doc of recentRunsSnap.docs) {
    const data = doc.data();
    const ts = data.triggeredAt?.toDate?.()?.toISOString?.() || String(data.triggeredAt || '');
    const key = `${ts}|${String(data.status || '')}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }

  const duplicateGroups = [...seen.entries()].filter(([, count]) => count > 1);
  console.log(`duplicate.run.groups=${duplicateGroups.length}`);
  assertOrThrow(duplicateGroups.length === 0, `Duplicate autopilot run groups detected: ${duplicateGroups.length}`);

  const allowedDealStatuses = new Set(['draft', 'pending', 'poczekalnia', 'approved', 'rejected', 'expired']);
  const dealSample = await db.collection('deals').limit(400).get();
  let invalidDealStatuses = 0;
  for (const doc of dealSample.docs) {
    const status = String(doc.data().status || '');
    if (!allowedDealStatuses.has(status)) invalidDealStatuses += 1;
  }
  console.log(`invalid.deal.statuses.sample=${invalidDealStatuses}`);
  assertOrThrow(invalidDealStatuses === 0, `Invalid deal statuses found in sample: ${invalidDealStatuses}`);

  const allowedCoreStatuses = new Set(['draft', 'pending_approval', 'approved', 'rejected']);
  const coreSample = await db.collection('product_cores').limit(400).get();
  let invalidCoreStatuses = 0;
  for (const doc of coreSample.docs) {
    const status = String(doc.data().status || '');
    if (!allowedCoreStatuses.has(status)) invalidCoreStatuses += 1;
  }
  console.log(`invalid.product_core.statuses.sample=${invalidCoreStatuses}`);
  assertOrThrow(invalidCoreStatuses === 0, `Invalid product_core statuses found in sample: ${invalidCoreStatuses}`);

  const approvedLegacyProducts = await db.collection('products').where('status', '==', 'approved').count().get();
  console.log(`legacy.products.approved=${approvedLegacyProducts.data().count}`);

  console.log('CANARY PASSED');
}

main().catch((error) => {
  console.error('CANARY FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
