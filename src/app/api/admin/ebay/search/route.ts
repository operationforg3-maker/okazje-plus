import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { createEbayClient } from '@/integrations/ebay/client';
import { EbayClientConfig } from '@/integrations/ebay/types';

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

const ebayConfig: EbayClientConfig = {
  clientId: process.env.EBAY_CLIENT_ID || '',
  clientSecret: process.env.EBAY_CLIENT_SECRET || '',
  sandbox: process.env.EBAY_SANDBOX === 'true',
  marketplaceId: 'EBAY_PL',
};

export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const allowed = await isAdminUser(idToken);
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    const { q, minPrice, maxPrice, limit } = body;

    if (!q) {
      return NextResponse.json({ error: 'query_required' }, { status: 400 });
    }

    // Create eBay client
    const client = createEbayClient(ebayConfig);

    // Build price filter
    const filters: string[] = [];
    if (minPrice || maxPrice) {
      const min = minPrice || 0;
      const max = maxPrice || 999999;
      filters.push(`price:[${min}..${max}],priceCurrency:PLN`);
    }

    // Search for items
    const searchResponse = await client.searchItems({
      q,
      filter: filters.join('|'),
      limit: Math.min(limit || 50, 200),
      offset: 0,
    });

    // Transform response
    const products = (searchResponse.itemSummaries || []).map(item => ({
      itemId: item.itemId,
      title: item.title,
      image: item.image,
      price: item.price,
      itemWebUrl: item.itemWebUrl,
      seller: item.seller,
      condition: item.condition,
      buyingOptions: item.buyingOptions,
      shippingOptions: item.shippingOptions,
    }));

    return NextResponse.json({
      success: true,
      products,
      totalCount: searchResponse.total,
    });
  } catch (error: any) {
    console.error('eBay search error:', error);
    return NextResponse.json(
      { error: error.message || 'search_failed' },
      { status: 500 }
    );
  }
}
