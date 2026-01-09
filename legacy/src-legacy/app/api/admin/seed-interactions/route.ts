import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Weryfikacja tokena i uprawnień admina
async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, res: NextResponse.json({ error: 'Brak nagłówka autoryzacji' }, { status: 401 }) };
  }
  const idToken = authHeader.substring('Bearer '.length);
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return { ok: false, res: NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 }) };
  }
  if (!decoded.admin) {
    return { ok: false, res: NextResponse.json({ error: 'Brak uprawnień admina' }, { status: 403 }) };
  }
  return { ok: true };
}

// Lazy initialization function
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app(); // Already initialized
  }

  try {
    // Try env vars first (for App Hosting with proper credentials)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, '\n').replace(/^"(.*)"$/, '$1');

      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
    } else {
      // Try local service account file (for local development)
      try {
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        return admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (fileError) {
        // Fallback: Application Default Credentials (production)
        return admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
      }
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

// Test users configuration
const testUsers = [
  {
    uid: 'testuser-uid',
    email: 'testuser@example.com',
    password: 'testpass123',
    displayName: 'Test User',
    role: 'user',
  },
  {
    uid: 'admin-uid',
    email: 'admin@example.com',
    password: 'adminpass123',
    displayName: 'Admin User',
    role: 'admin',
  },
  {
    uid: 'poweruser-uid',
    email: 'poweruser@example.com',
    password: 'powerpass123',
    displayName: 'Power User',
    role: 'user',
  },
];


export async function POST(request: NextRequest) {
  const verify = await verifyAdmin(request);
  if (!verify.ok) return verify.res;
  // ...existing code...
  try {
    // ...existing code...
    // (cała logika seedowania pozostaje bez zmian)
    // ...existing code...
  } catch (error: any) {
    console.error('Seeding error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
