/**
 * Firebase Admin SDK initialization for server-side operations
 * Used in Server Actions and Cloud Functions
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let adminApp: admin.app.App | null = null;

export function getAdminFirestore(): admin.firestore.Firestore {
  if (!adminApp) {
    initializeAdmin();
  }
  return admin.firestore();
}

function initializeAdmin() {
  if (admin.apps.length > 0) {
    adminApp = admin.app();
    return;
  }

  try {
    // Try environment variables first (for Firebase App Hosting)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, '\n').replace(/^"(.*)"$/, '$1');
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
      return;
    }

    // Try local service account file (for local development)
    try {
      const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
      const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountJson);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      return;
    } catch (fileError) {
      // Fallback: Application Default Credentials (production)
      adminApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      return;
    }
  } catch (error) {
    console.error('[firebase-admin-server] Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

// Ensure initialization on module load
if (!adminApp && typeof window === 'undefined') {
  try {
    initializeAdmin();
  } catch (e) {
    console.error('[firebase-admin-server] Failed to initialize on module load:', e);
  }
}
