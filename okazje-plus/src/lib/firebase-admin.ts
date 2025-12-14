import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

function loadServiceAccount() {
  // Prefer runtime-provided JSON from environment (App Hosting Secret)
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson);
      if (parsed && parsed.project_id) {
        return parsed;
      }
      console.warn('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON is present but missing project_id');
    } catch (e: any) {
      console.warn('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON, falling back:', e);
    }
  }

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
