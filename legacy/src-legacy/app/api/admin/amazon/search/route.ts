import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { createAmazonClient } from '@/integrations/amazon/client';
import { AmazonClientConfig } from '@/integrations/amazon/types';

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
    const { keywords, minPrice, maxPrice, limit } = body;

    if (!keywords) {
      return NextResponse.json({ error: 'keywords_required' }, { status: 400 });
    }

    // Create Amazon client with env credentials
    const amazonConfig: AmazonClientConfig = {
      accessKey: process.env.AMAZON_ACCESS_KEY || '',
      secretKey: process.env.AMAZON_SECRET_KEY || '',
      partnerTag: process.env.AMAZON_PARTNER_TAG || '',
      region: 'eu-west-1',
      marketplace: 'www.amazon.pl',
    };

    if (!amazonConfig.accessKey || !amazonConfig.secretKey || !amazonConfig.partnerTag) {
      return NextResponse.json({ error: 'amazon_credentials_missing' }, { status: 500 });
    }

    const client = createAmazonClient(amazonConfig);

    // Search for products
    const searchResponse = await client.searchProducts({
      keywords,
      minPrice,
      maxPrice,
      limit: Math.min(limit || 50, 10),
      page: 1,
    });

    // Transform response
    const products = searchResponse.products.map(item => ({
      asin: item.asin,
      title: item.title,
      price: {
        current: item.price.current,
        original: item.price.original,
        currency: item.price.currency,
      },
      imageUrls: item.imageUrls,
      productUrl: item.productUrl,
      rating: item.rating,
      merchantInfo: item.merchantInfo,
      description: item.description,
    }));

    return NextResponse.json({
      success: true,
      products,
      totalCount: searchResponse.totalResults,
    });
  } catch (error: any) {
    console.error('Amazon search error:', error);
    return NextResponse.json(
      { error: error.message || 'search_failed' },
      { status: 500 }
    );
  }
}
