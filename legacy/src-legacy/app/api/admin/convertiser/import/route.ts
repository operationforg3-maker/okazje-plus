import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

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
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    const { product, mainCategory, subCategory, subSubCategory } = body;

    if (!product?.name || !mainCategory || !subCategory) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const app = initializeFirebaseAdmin();
    const db = admin.firestore();
    const decoded = idToken ? await admin.auth().verifyIdToken(idToken) : null;

    // Check for duplicates by Convertiser UUID
    const externalId = product.uuid || null;
    if (externalId) {
      const existingQuery = await db
        .collection('products')
        .where('metadata.originalId', '==', externalId)
        .where('metadata.source', '==', 'manual')
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        return NextResponse.json(
          { error: 'duplicate_product' },
          { status: 409 }
        );
      }
    }

    // Create product document
    const productDoc = {
      name: product.name,
      description: product.description || '',
      longDescription: product.description || '',
      price: parseFloat(product.price) || 0,
      originalPrice: undefined,
      discountPercent: 0,
      image: product.image || '',
      imageHint: product.name,
      affiliateUrl: product.offerUuid ? `https://convertiser.com/offers/${product.offerUuid}/` : '',
      mainCategorySlug: mainCategory,
      subCategorySlug: subCategory,
      subSubCategorySlug: subSubCategory || undefined,
      status: 'draft',
      rating: 0,
      soldCount: 0,
      merchantRating: 0,
      merchant: product.advertiser || 'Convertiser',
      gallery: product.image ? [
        {
          id: `convertiser_${product.uuid}_0`,
          src: product.image,
          alt: product.name,
          isPrimary: true,
          source: 'manual' as const,
          type: 'url' as const,
          addedAt: new Date().toISOString(),
        }
      ] : [],
      ratingCard: {
        average: 0,
        count: 0,
        durability: 0,
        easeOfUse: 0,
        valueForMoney: 0,
        versatility: 0,
      },
      metadata: {
        source: 'manual',
        originalId: externalId,
        importedAt: new Date().toISOString(),
        importedBy: decoded?.uid || 'system',
        rawDataStored: false,
        convertiserCommission: product.commission,
        convertiserAdvertiser: product.advertiser,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('products').add(productDoc);

    return NextResponse.json({
      success: true,
      productId: docRef.id,
    });
  } catch (error: any) {
    console.error('Convertiser import error:', error);
    return NextResponse.json(
      { error: error.message || 'import_failed' },
      { status: 500 }
    );
  }
}
