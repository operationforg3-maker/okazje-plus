import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

let adminApp: App | undefined;

// Na App Hosting używamy domyślnych credentials (Application Default Credentials)
// Lokalnie można opcjonalnie załadować serviceAccountKey.json jeśli istnieje
if (!getApps().length) {
  const isAppHosting = !!process.env.K_SERVICE; // Cloud Run / App Hosting
  const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
  const hasServiceAccountFile = existsSync(serviceAccountPath);

  // Jeśli mamy jawne GOOGLE_APPLICATION_CREDENTIALS wskazujące na plik json użyj go w pierwszej kolejności
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    try {
      const raw = readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
      const parsed = JSON.parse(raw);
      console.log('[firebase-admin] Using GOOGLE_APPLICATION_CREDENTIALS file');
      adminApp = initializeApp({
        credential: cert({
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        }),
      });
    } catch (e) {
      console.warn('[firebase-admin] Failed to parse GOOGLE_APPLICATION_CREDENTIALS file, falling back:', e);
    }
  }

  if (!adminApp) {
    if (isAppHosting) {
      // App Hosting / Cloud Run posiada ADC automatycznie
      adminApp = initializeApp();
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
        adminApp = initializeApp();
      }
    } else {
      // Ostatnia próba: ADC lokalne (wymaga `gcloud auth application-default login`)
      console.warn('[firebase-admin] No service account file. Using Application Default Credentials. If UNAUTHENTICATED appears run: gcloud auth application-default login');
      adminApp = initializeApp();
    }
  }
} else {
  adminApp = getApps()[0];
}

// Configure Firestore with ignoreUndefinedProperties for better dev experience
const adminDb = getFirestore(adminApp);
adminDb.settings({
  ignoreUndefinedProperties: true,
});

const adminAuth = getAuth(adminApp);

export { adminDb, adminApp, adminAuth };