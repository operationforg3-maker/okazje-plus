import { getApps, initializeApp, cert, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue as FirestoreFieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

let adminApp: App | undefined;

// Updated: 2025-12-03 - Fixed App Hosting Firestore permissions (datastore.user role added)
// Updated: 2026-01-12 - Add Next.js build-time dummy credentials

// Na App Hosting używamy domyślnych credentials (Application Default Credentials)
// Lokalnie można opcjonalnie załadować serviceAccountKey.json jeśli istnieje
if (!getApps().length) {
  const isAppHosting = !!process.env.K_SERVICE; // Cloud Run / App Hosting
  const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.CI === 'true';
  const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
  const hasServiceAccountFile = existsSync(serviceAccountPath);

  // Build-time fallback for Next.js CI build (no secrets available during page data collection)
  if (isBuildTime && !adminApp) {
    console.log('[firebase-admin] Using build-time dummy credentials (Next.js CI build)');
    adminApp = initializeApp({
      projectId: 'build-time-dummy',
      credential: {
        getAccessToken: async () => ({ access_token: 'build-dummy-token', expiry_date: Date.now() + 3600_000 }),
        getProjectId: async () => 'build-time-dummy',
      } as any,
    });
  }

  // CI / test fallback: provide dummy credentials to allow unit tests without real ADC
  const isCiOrTest = process.env.CI === 'true' || process.env.NODE_ENV === 'test';
  if (!adminApp && isCiOrTest && !isAppHosting && !isBuildTime) {
    adminApp = initializeApp({
      projectId: 'demo-test',
      credential: {
        getAccessToken: async () => ({ access_token: 'test-token', expiry_date: Date.now() + 3600_000 }),
        getProjectId: async () => 'demo-test',
      } as any,
    });
  }

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
        if (isAppHosting) {
          throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON brakuje wymaganych pól (project_id, client_email, private_key) - sprawdź Secret Manager');
        }
      }
    } catch (e) {
      console.warn('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON', e);
      if (isAppHosting) {
        throw e;
      }
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
        console.warn('[firebase-admin] GOOGLE_APPLICATION_CREDENTIALS is present but missing required fields');
        if (isAppHosting) {
          throw new Error('GOOGLE_APPLICATION_CREDENTIALS nie zawiera wymaganych pól - uzupełnij Secret/plik z pełnym JSON');
        }
      }
    } catch (e) {
      console.warn('[firebase-admin] Failed to parse GOOGLE_APPLICATION_CREDENTIALS file', e);
      if (isAppHosting) {
        throw e;
      }
    }
  }

  if (!adminApp) {
    if (isAppHosting) {
      try {
        console.log('[firebase-admin] Running on App Hosting/Cloud Run. Initializing with Application Default Credentials (ADC)...');
        adminApp = initializeApp({
          credential: applicationDefault(),
        });
      } catch (e) {
        console.error('[firebase-admin] Failed to initialize with ADC on App Hosting:', e);
        throw new Error('Brak poprawnych poświadczeń Firebase Admin na App Hosting. Ustaw Secret FIREBASE_SERVICE_ACCOUNT_JSON (pełny JSON) lub popraw GOOGLE_APPLICATION_CREDENTIALS.');
      }
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
      try {
        adminApp = initializeApp({
          credential: applicationDefault(),
        });
      } catch (e) {
        // Next.js build time: can't use ADC. Use dummy fallback.
        console.warn('[firebase-admin] ADC failed (likely Next.js build). Using dummy fallback:', e);
        adminApp = initializeApp({
          projectId: 'build-time-dummy',
          credential: {
            getAccessToken: async () => ({ access_token: 'build-dummy', expiry_date: Date.now() + 3600_000 }),
            getProjectId: async () => 'build-time-dummy',
          } as any,
        });
      }
    }
  }
} else {
  adminApp = getApps()[0];
}

// Lazy getters to avoid initialization during build
let cachedDb: ReturnType<typeof getFirestore> | null = null;
let cachedAuth: ReturnType<typeof getAuth> | null = null;
let initialized = false;

function ensureInitialized() {
  if (initialized || !adminApp) return;
  initialized = true;
  
  try {
    cachedDb = getFirestore(adminApp);
    // Only set settings if not already configured
    try {
      cachedDb.settings({
        ignoreUndefinedProperties: true,
      });
    } catch (error: any) {
      // Settings already configured, ignore
      if (!error.message?.includes('already been initialized')) {
        console.warn('[firebase-admin] Failed to configure Firestore settings:', error);
      }
    }
  } catch (e) {
    console.error('[firebase-admin] Failed to initialize Firestore:', e);
    throw e;
  }
  
  try {
    cachedAuth = getAuth(adminApp);
  } catch (e) {
    console.error('[firebase-admin] Failed to initialize Auth:', e);
    throw e;
  }
}

// Create lazy proxies for backward compatibility
class LazyDb {
  collection(...args: any[]) { ensureInitialized(); return (cachedDb as any).collection(...args); }
  doc(...args: any[]) { ensureInitialized(); return (cachedDb as any).doc(...args); }
  collectionGroup(...args: any[]) { ensureInitialized(); return (cachedDb as any).collectionGroup(...args); }
  batch() { ensureInitialized(); return (cachedDb as any).batch(); }
  bulkWriter() { ensureInitialized(); return (cachedDb as any).bulkWriter(); }
  runTransaction(updateFunction: any) { ensureInitialized(); return (cachedDb as any).runTransaction(updateFunction); }
  setLogFunction(logFn: any) { ensureInitialized(); return (cachedDb as any).setLogFunction(logFn); }
  settings(settings: any) { ensureInitialized(); return (cachedDb as any).settings(settings); }
  listCollections() { ensureInitialized(); return (cachedDb as any).listCollections(); }
  listDocuments() { ensureInitialized(); return (cachedDb as any).listDocuments(); }
  getAll(...args: any[]) { ensureInitialized(); return (cachedDb as any).getAll(...args); }
  recursiveDelete(ref: any) { ensureInitialized(); return (cachedDb as any).recursiveDelete(ref); }
  toJSON() { ensureInitialized(); return (cachedDb as any).toJSON(); }
}

class LazyAuth {
  getUser(uid: string) { ensureInitialized(); return (cachedAuth as any).getUser(uid); }
  getUserByEmail(email: string) { ensureInitialized(); return (cachedAuth as any).getUserByEmail(email); }
  getUserByPhoneNumber(phoneNumber: string) { ensureInitialized(); return (cachedAuth as any).getUserByPhoneNumber(phoneNumber); }
  createUser(properties: any) { ensureInitialized(); return (cachedAuth as any).createUser(properties); }
  updateUser(uid: string, properties: any) { ensureInitialized(); return (cachedAuth as any).updateUser(uid, properties); }
  deleteUser(uid: string) { ensureInitialized(); return (cachedAuth as any).deleteUser(uid); }
  listUsers(maxResults?: number, pageToken?: string) { ensureInitialized(); return (cachedAuth as any).listUsers(maxResults, pageToken); }
  getSignUpUrl(settings: any) { ensureInitialized(); return (cachedAuth as any).getSignUpUrl(settings); }
  createSessionCookie(idToken: string, options: any) { ensureInitialized(); return (cachedAuth as any).createSessionCookie(idToken, options); }
  verifySessionCookie(sessionCookie: string, checkRevoked?: boolean) { ensureInitialized(); return (cachedAuth as any).verifySessionCookie(sessionCookie, checkRevoked); }
  revokeRefreshTokens(uid: string) { ensureInitialized(); return (cachedAuth as any).revokeRefreshTokens(uid); }
  verifyIdToken(idToken: string, checkRevoked?: boolean) { ensureInitialized(); return (cachedAuth as any).verifyIdToken(idToken, checkRevoked); }
  setCustomUserClaims(uid: string, customUserClaims: any) { ensureInitialized(); return (cachedAuth as any).setCustomUserClaims(uid, customUserClaims); }
  getTenant(tenantId: string) { ensureInitialized(); return (cachedAuth as any).getTenant(tenantId); }
  createTenant(tenantOptions: any) { ensureInitialized(); return (cachedAuth as any).createTenant(tenantOptions); }
  listTenants(maxResults?: number, pageToken?: string) { ensureInitialized(); return (cachedAuth as any).listTenants(maxResults, pageToken); }
  updateTenant(tenantId: string, tenantOptions: any) { ensureInitialized(); return (cachedAuth as any).updateTenant(tenantId, tenantOptions); }
  deleteTenant(tenantId: string) { ensureInitialized(); return (cachedAuth as any).deleteTenant(tenantId); }
  createCustomToken(uid: string, additionalClaims?: any) { ensureInitialized(); return (cachedAuth as any).createCustomToken(uid, additionalClaims); }
  verifyIdTokenAsync(idToken: string, checkRevoked?: boolean) { ensureInitialized(); return (cachedAuth as any).verifyIdTokenAsync(idToken, checkRevoked); }
}

const adminDb = new LazyDb() as any;
const adminAuth = new LazyAuth() as any;

// Export FieldValue & FieldPath
export const FieldValue = FirestoreFieldValue;
export { FieldPath } from 'firebase-admin/firestore';

export { adminDb, adminApp, adminAuth };