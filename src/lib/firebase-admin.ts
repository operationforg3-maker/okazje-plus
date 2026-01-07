import { getApps, initializeApp, cert, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue as FirestoreFieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

let adminApp: App | undefined;

// Updated: 2025-12-03 - Fixed App Hosting Firestore permissions (datastore.user role added)

// Na App Hosting używamy domyślnych credentials (Application Default Credentials)
// Lokalnie można opcjonalnie załadować serviceAccountKey.json jeśli istnieje
if (!getApps().length) {
  const isAppHosting = !!process.env.K_SERVICE; // Cloud Run / App Hosting
  const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
  const hasServiceAccountFile = existsSync(serviceAccountPath);

  // 1) Prefer explicit JSON provided via env (App Hosting Secret)
  if (!adminApp && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        console.log('[firebase-admin] Using FIREBASE_SERVICE_ACCOUNT_JSON from environment');
        adminApp = initializeApp({
          credential: cert({
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: parsed.private_key,
          }),
        });
      } else {
        console.warn('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON missing required fields');
      }
    } catch (e) {
      console.warn('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON, falling back:', e);
    }
  }

  // Jeśli mamy jawne GOOGLE_APPLICATION_CREDENTIALS wskazujące na plik json użyj go w pierwszej kolejności
  if (!adminApp && process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    try {
      const raw = readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
      const parsed = JSON.parse(raw);
      const hasRequiredFields = parsed?.project_id && parsed?.client_email && parsed?.private_key;
      if (hasRequiredFields) {
        console.log('[firebase-admin] Using GOOGLE_APPLICATION_CREDENTIALS file');
        adminApp = initializeApp({
          credential: cert({
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: parsed.private_key,
          }),
        });
      } else {
        console.warn('[firebase-admin] GOOGLE_APPLICATION_CREDENTIALS is present but missing required fields; falling back to applicationDefault()');
        adminApp = initializeApp({
          credential: applicationDefault(),
        });
      }
    } catch (e) {
      console.warn('[firebase-admin] Failed to parse GOOGLE_APPLICATION_CREDENTIALS file, falling back to applicationDefault():', e);
      adminApp = initializeApp({
        credential: applicationDefault(),
      });
    }
  }

  if (!adminApp) {
    if (isAppHosting) {
      // App Hosting / Cloud Run posiada ADC automatycznie
      adminApp = initializeApp({
        credential: applicationDefault(),
      });
    } else if (hasServiceAccountFile) {
      try {
        const raw = readFileSync(serviceAccountPath, 'utf8');
        const parsed = JSON.parse(raw);
        // Ustaw zmienną aby inne biblioteki mogły korzystać (np. gcloud auth w subprocesach)
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(serviceAccountPath);
        }
        console.log('[firebase-admin] Using local serviceAccountKey.json');
        adminApp = initializeApp({
          credential: cert({
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: parsed.private_key,
          }),
        });
      } catch (e) {
        console.warn('[firebase-admin] Failed to initialize with serviceAccountKey.json, fallback to ADC:', e);
        adminApp = initializeApp({
          credential: applicationDefault(),
        });
      }
    } else {
      // Ostatnia próba: ADC lokalne (wymaga `gcloud auth application-default login`)
      console.warn('[firebase-admin] No service account file. Using Application Default Credentials. If UNAUTHENTICATED appears run: gcloud auth application-default login');
      adminApp = initializeApp({
        credential: applicationDefault(),
      });
    }
  }
} else {
  adminApp = getApps()[0];
}

// Configure Firestore with ignoreUndefinedProperties for better dev experience
const adminDb = getFirestore(adminApp);

// Only set settings if not already configured
try {
  adminDb.settings({
    ignoreUndefinedProperties: true,
  });
} catch (error: any) {
  // Settings already configured, ignore
  if (!error.message?.includes('already been initialized')) {
    throw error;
  }
}

const adminAuth = getAuth(adminApp);

// Export FieldValue for array operations
export const FieldValue = FirestoreFieldValue;

export { adminDb, adminApp, adminAuth };