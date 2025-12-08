import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

function loadServiceAccount() {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const raw = fs.readFileSync(serviceAccountPath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      console.warn('[firebase-admin] Failed to parse serviceAccountKey.json, falling back to ADC', error);
    }
  }
  return null;
}

const existing = getApps();
const app = existing.length
  ? existing[0]
  : initializeApp(
      loadServiceAccount()
        ? { credential: cert(loadServiceAccount() as any) }
        : { credential: applicationDefault() }
    );

export const db = getFirestore(app);
