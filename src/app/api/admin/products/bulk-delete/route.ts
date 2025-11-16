import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.app();

  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, '\n').replace(/^"(.*)"$/, '$1');
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    } else {
      try {
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } catch (fileError) {
        return admin.initializeApp({ credential: admin.credential.applicationDefault() });
      }
    }
  } catch (e) {
    console.error('Failed to init Firebase Admin:', e);
    throw e;
  }
}

async function isAdminUser(idToken: string | null) {
  if (!idToken) return false;
  try {
    const app = initializeFirebaseAdmin();
    const auth = admin.auth();
    const decoded = await auth.verifyIdToken(idToken);
    if ((decoded as any).admin) return true;
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (userDoc.exists) {
      const data = userDoc.data() as any;
      return data?.role === 'admin';
    }
    return false;
  } catch (e) {
    console.warn('Admin check failed:', e);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const allowed = await isAdminUser(idToken);
    
    if (!allowed) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { confirmation } = body;

    // Require explicit confirmation
    if (confirmation !== 'DELETE_ALL_PRODUCTS') {
      return NextResponse.json({ 
        error: 'invalid_confirmation',
        message: 'Musisz potwierdzić operację wpisując "DELETE_ALL_PRODUCTS"'
      }, { status: 400 });
    }

    const app = initializeFirebaseAdmin();
    const db = admin.firestore();
    const decoded = idToken ? await admin.auth().verifyIdToken(idToken) : null;

    // Fetch all products
    const productsSnapshot = await db.collection('products').get();
    const batchSize = 500; // Firestore batch limit
    let deleted = 0;

    console.log(`[BULK DELETE] Starting deletion of ${productsSnapshot.size} products by user ${decoded?.uid}`);

    // Delete in batches
    for (let i = 0; i < productsSnapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = productsSnapshot.docs.slice(i, i + batchSize);
      
      batchDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      deleted += batchDocs.length;
      console.log(`[BULK DELETE] Deleted batch: ${deleted}/${productsSnapshot.size} products`);
    }

    // Log the action
    await db.collection('audit_logs').add({
      action: 'bulk_delete_products',
      performedBy: decoded?.uid || 'unknown',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      count: deleted,
      metadata: {
        confirmation,
      }
    });

    console.log(`[BULK DELETE] Completed: ${deleted} products deleted`);

    return NextResponse.json({ 
      success: true, 
      deleted,
      message: `Usunięto ${deleted} produktów`
    });
  } catch (error) {
    console.error('Bulk delete products failed:', error);
    return NextResponse.json({ 
      error: 'bulk_delete_failed', 
      message: String(error) 
    }, { status: 500 });
  }
}
