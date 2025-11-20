import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let adminApp: App;

// Na App Hosting używamy domyślnych credentials (Application Default Credentials)
// Lokalnie można opcjonalnie załadować serviceAccountKey.json jeśli istnieje
if (!getApps().length) {
  const isAppHosting = !!process.env.K_SERVICE; // Cloud Run / App Hosting
  
  if (isAppHosting) {
    // Domyślne credentials z App Hosting (automatyczne)
    adminApp = initializeApp();
  } else {
    // Lokalnie: spróbuj załadować serviceAccountKey.json jeśli istnieje
    const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');
    
    if (existsSync(serviceAccountPath)) {
      try {
        const serviceAccountFile = readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountFile);
        
        console.log('[firebase-admin] Using serviceAccountKey.json');
        adminApp = initializeApp({
          credential: cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key,
          }),
        });
      } catch (error) {
        console.warn('[firebase-admin] Failed to load serviceAccountKey.json:', error);
        console.warn('[firebase-admin] Falling back to default credentials');
        adminApp = initializeApp();
      }
    } else {
      // Fallback do domyślnych credentials (jeśli gcloud auth application-default login)
      console.warn('[firebase-admin] serviceAccountKey.json not found, using default credentials');
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