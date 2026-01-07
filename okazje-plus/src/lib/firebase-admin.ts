import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

function loadServiceAccount() {
  // Prefer runtime-provided JSON from environment (Secret Manager)
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        return parsed;
      }
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON lacks required fields (project_id, client_email, private_key)');
    } catch (e: any) {
      console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON invalid', e);
      throw e;
    }
  }

  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const raw = fs.readFileSync(serviceAccountPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        return parsed;
      }
      throw new Error('serviceAccountKey.json missing required fields');
    } catch (error) {
      console.error('[firebase-admin] serviceAccountKey.json invalid', error);
      throw error;
    }
  }

  // Functions have ADC by default; but if nothing is provided explicitly, we rely on applicationDefault
  return null;
}

const existing = getApps();
const app = existing.length
  ? existing[0]
  : (() => {
      const sa = loadServiceAccount();
      if (sa) {
        return initializeApp({ credential: cert(sa as any) });
      }
      // Firebase Functions runtime supplies ADC automatically; allow that as last resort
      return initializeApp({ credential: applicationDefault() });
    })();

export const db = getFirestore(app);
