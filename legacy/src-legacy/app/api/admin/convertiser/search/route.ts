import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { getConvertiserClient } from '@/lib/integrations/convertiser-client';

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
    const { query, category, minPrice, maxPrice, page, pageSize } = body;

    if (!query) {
      return NextResponse.json({ error: 'query_required' }, { status: 400 });
    }

    // Get Convertiser client
    const client = getConvertiserClient();

    // Search for products using Convertiser Products API v2
    const searchResponse = await client.searchProductsV2(
      {
        q: query,
        category: category || undefined,
        price_min: minPrice,
        price_max: maxPrice,
      },
      {
        page: page || 1,
        page_size: pageSize || 30,
      }
    );

    // Transform response
    const products = (searchResponse.results || []).map(item => ({
      uuid: item.uuid,
      name: item.name,
      price: {
        amount: item.price || 0,
        currency: item.currency || 'PLN',
      },
      image: item.image_url || item.image,
      description: item.description || '',
      commission: item.commission,
      advertiser: item.advertiser_name || item.advertiser,
      offer_uuid: item.offer_uuid,
      category_slug: item.category_slug,
    }));

    return NextResponse.json({
      success: true,
      products,
      totalCount: searchResponse.count || 0,
      page,
    });
  } catch (error: any) {
    console.error('Convertiser search error:', error);
    return NextResponse.json(
      { error: error.message || 'search_failed' },
      { status: 500 }
    );
  }
}
