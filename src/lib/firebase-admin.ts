import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
    try {
      const serviceAccount = require('../../serviceAccountKey.json');
      adminApp = initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
      });
    } catch (error) {
      // Fallback do domyślnych credentials (jeśli gcloud auth application-default login)
      console.warn('[firebase-admin] serviceAccountKey.json not found, using default credentials');
      adminApp = initializeApp();
    }
  }
} else {
  adminApp = getApps()[0];
}

export const adminDb = getFirestore(adminApp);
export { adminApp };