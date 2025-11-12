import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
 dotenv.config({ path: '.env.local' });

async function initAdmin() {
  if (admin.apps.length) return;
  let credentialData: any = null;
  const projectIdEnv = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    credentialData = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const svc = require('./serviceAccountKey.json');
      if (!svc.project_id || !svc.client_email || !svc.private_key) {
        throw new Error('serviceAccountKey.json missing required fields');
      }
      const cleanedKey = (svc.private_key as string)
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n');
      credentialData = {
        projectId: svc.project_id,
        clientEmail: svc.client_email,
        privateKey: cleanedKey,
      };
    } catch (e) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectIdEnv,
      });
      admin.firestore().settings({ ignoreUndefinedProperties: true });
      return;
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(credentialData!),
    projectId: projectIdEnv,
  });
  admin.firestore().settings({ ignoreUndefinedProperties: true });
}

function computeDiscountPercent(originalPrice?: number | null, price?: number | null): number | null {
  const op = Number(originalPrice ?? 0);
  const p = Number(price ?? 0);
  if (op > 0 && p >= 0 && p < op) {
    return Math.round(((op - p) / op) * 100);
  }
  return null;
}

async function run() {
  await initAdmin();
  const db = admin.firestore();

  const pageSize = 500;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let updated = 0;
  let scanned = 0;

  while (true) {
    let query = db.collection('products').orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      scanned++;
      const data = doc.data() as any;
      const updates: any = {};

      // backfill status
      if (!data.status) updates.status = 'draft';

      // backfill metadata
      if (!data.metadata) {
        updates.metadata = {
          source: data.externalId ? 'aliexpress' : 'manual',
          originalId: data.externalId || null,
          importedAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          rawDataStored: false,
        };
      }

      // backfill discountPercent
      if (data.discountPercent === undefined || data.discountPercent === null) {
        const dp = computeDiscountPercent(data.originalPrice, data.price);
        if (dp !== null) updates.discountPercent = dp;
      }

      if (Object.keys(updates).length > 0) {
        batch.update(doc.ref, updates);
        updated++;
      }
    }
    await batch.commit();
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(`Products scanned: ${scanned}, updated: ${updated}`);
  process.exit(0);
}

run().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
