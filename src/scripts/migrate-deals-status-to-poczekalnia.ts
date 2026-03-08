import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin';
import fs from 'fs';
import path from 'path';

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function loadServiceAccount(): ServiceAccount {
  const explicitPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const defaultPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  const targetPath = explicitPath || defaultPath;

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Brak pliku credentials: ${targetPath}`);
  }

  const raw = fs.readFileSync(targetPath, 'utf8');
  const parsed = JSON.parse(raw) as ServiceAccountJson;

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('Nieprawidlowy format service account');
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, '\n'),
  };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const serviceAccount = loadServiceAccount();

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  const db = getFirestore();
  const pendingSnapshot = await db
    .collection('deals')
    .where('status', '==', 'pending')
    .get();

  console.log(`[migrate-status] znaleziono dokumentow pending: ${pendingSnapshot.size}`);

  if (pendingSnapshot.empty) {
    console.log('[migrate-status] brak rekordow do migracji');
    return;
  }

  if (dryRun) {
    console.log('[migrate-status] dry-run aktywny, bez zapisu');
    return;
  }

  const docs = pendingSnapshot.docs;
  const chunkSize = 400;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const batch = db.batch();

    for (const doc of chunk) {
      batch.update(doc.ref, {
        status: 'poczekalnia',
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
    console.log(`[migrate-status] zaktualizowano ${Math.min(i + chunk.length, docs.length)}/${docs.length}`);
  }

  console.log('[migrate-status] migracja zakonczona sukcesem');
}

main().catch((error) => {
  console.error('[migrate-status] blad:', error);
  process.exit(1);
});
