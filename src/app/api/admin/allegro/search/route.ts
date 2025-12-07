import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { createAllegroClient } from '@/integrations/allegro/client';
import { AllegroClientConfig } from '@/integrations/allegro/types';

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

const allegroConfig: AllegroClientConfig = {
  clientId: process.env.ALLEGRO_APP_KEY || '',
  clientSecret: process.env.ALLEGRO_APP_SECRET || '',
  sandbox: process.env.ALLEGRO_SANDBOX === 'true',
};

export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const allowed = await isAdminUser(idToken);
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    const { phrase, minPrice, maxPrice, limit } = body;

    if (!phrase) {
      return NextResponse.json({ error: 'phrase_required' }, { status: 400 });
    }

    // Create Allegro client
    const client = createAllegroClient(allegroConfig);

    // Search for products
    const searchResponse = await client.searchOffers({
      phrase,
      'parameter.price.from': minPrice,
      'parameter.price.to': maxPrice,
      limit: Math.min(limit || 50, 100),
      offset: 0,
    });

    // Transform response
    const products = [
      ...searchResponse.items.promoted,
      ...searchResponse.items.regular,
    ].map(item => ({
      id: item.id,
      name: item.name,
      price: item.sellingMode?.price?.amount || 0,
      currency: item.sellingMode?.price?.currency || 'PLN',
      imageUrl: item.images?.[0]?.url || '',
      itemWebUrl: item.webUrl || '',
      seller: {
        login: item.seller?.login || '',
        feedbackScore: undefined,
      },
      stats: {
        visitsCount: item.stats?.visitsCount || 0,
        watchersCount: item.stats?.watchersCount || 0,
      },
      description: item.shortDescription || '',
    }));

    return NextResponse.json({
      success: true,
      products,
      totalCount: searchResponse.count,
    });
  } catch (error: any) {
    console.error('Allegro search error:', error);
    return NextResponse.json(
      { error: error.message || 'search_failed' },
      { status: 500 }
    );
  }
}
