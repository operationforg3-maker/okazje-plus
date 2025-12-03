import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';
import { aiProductEnrichmentPL } from '@/ai/flows/aliexpress/aiProductEnrichmentPL';

// Initialize Firebase Admin lazily (copied pattern from seed route)
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
    // Check custom claim 'admin' or check Firestore user doc
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
    const product = body.product;
    const mainCategory = body.mainCategory;
    const subCategory = body.subCategory;

    if (!product || !product.title) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

    const app = initializeFirebaseAdmin();
    const db = admin.firestore();
    const decoded = idToken ? await admin.auth().verifyIdToken(idToken) : null;

    // Deduplication: look for existing by externalId or link
    const externalId = product.id || product.externalId || null;
    if (externalId) {
      const q = await db.collection('products').where('metadata.originalId', '==', externalId).limit(1).get();
      if (!q.empty) return NextResponse.json({ ok: false, reason: 'already_exists' }, { status: 409 });
    }

    if (product.productUrl) {
      const q2 = await db.collection('products').where('affiliateUrl', '==', product.productUrl).limit(1).get();
      if (!q2.empty) return NextResponse.json({ ok: false, reason: 'already_exists' }, { status: 409 });
    }

    const docRef = db.collection('products').doc();
    const price = Number(product.price || 0);
    const originalPrice = product.originalPrice != null ? Number(product.originalPrice) : null;
    const discountPercent = (() => {
      const op = Number(originalPrice || 0);
      const p = Number(price || 0);
      if (op > 0 && p >= 0 && p < op) {
        return Math.round(((op - p) / op) * 100);
      }
      return undefined;
    })();

    const images: string[] = Array.isArray(product.images)
      ? product.images.filter((u: any) => typeof u === 'string') // Wszystkie zdjęcia
      : (product.imageUrl ? [product.imageUrl] : []); // Fallback do mainImage

    // Waluta z produktu lub domyślna PLN/USD
    const currency = product.currency || 'USD';
    
    // Shipping info z rozszerzonych danych
    const shippingInfo = product.shippingInfo || {};
    
    // Specyfikacje/atrybuty z pełnych szczegółów
    const specifications = product.specifications || product.attributes || null;

    const docData: any = {
      name: product.title, // Oryginalny tytuł (AI przetłumaczy później)
      description: product.descriptionHtml || product.description || product.subTitle || product.title || '',
      longDescription: product.descriptionHtml || product.description || product.title || '',
      image: images[0] || product.imageUrl || product.mainImage || null,
      imageHint: '',
      affiliateUrl: product.productUrl || product.url || null,
      currency: currency,
      ratingCard: {
        average: Number(product.rating || 0),
        count: Number(product.orders || 0),
        durability: Number(product.rating || 0),
        easeOfUse: Number(product.rating || 0),
        valueForMoney: Number(product.rating || 0),
        versatility: Number(product.rating || 0),
      },
      ratingSources: {
        external: {
          average: Number(product.rating || 0),
          count: Number(product.orders || 0),
          source: 'aliexpress',
          updatedAt: new Date().toISOString(),
        },
        users: {
          average: 0,
          count: 0,
          updatedAt: new Date().toISOString(),
        },
      },
      price,
      mainCategorySlug: mainCategory || null,
      subCategorySlug: subCategory || null,
      status: 'draft',
      metadata: {
        source: 'aliexpress',
        originalId: externalId || null,
        importedAt: admin.firestore.FieldValue.serverTimestamp(),
        importedBy: decoded?.uid || 'admin',
        orders: product.orders || null,
        shipping: product.shipping || null,
        merchant: product.merchant || null,
        merchantId: product.merchantId || null,
        // Nowe pola: warehouse, delivery, shipping details
        warehouse: shippingInfo.warehouse || null,
        deliveryTime: shippingInfo.deliveryTime || null,
        freeShipping: shippingInfo.freeShipping || false,
        shippingCost: shippingInfo.shippingCost || null,
        shippingMethod: shippingInfo.shippingMethod || null,
        categoryId: product.categoryId || null,
        categoryName: product.categoryName || null,
        videoUrl: product.productVideoUrl || product.videoUrl || null,
        specifications: specifications,
        variants: product.variants || null,
        rawDataStored: false,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add optional fields only if they have valid values
    if (originalPrice !== null && originalPrice !== undefined) {
      docData.originalPrice = originalPrice;
    }
    if (discountPercent !== null && discountPercent !== undefined) {
      docData.discountPercent = discountPercent;
    }

    if (images.length) {
      docData.gallery = images.map((url, idx) => ({
        id: `img_${idx}`,
        type: 'url',
        src: url,
        isPrimary: idx === 0,
        source: 'aliexpress',
        addedAt: new Date().toISOString(),
      }));
    }

    await docRef.set(docData);

    // AI Enrichment asynchronicznie (nie blokuj response)
    (async () => {
      try {
        console.log(`[import] Starting AI enrichment for product ${docRef.id}`);
        
        // 1. Normalizuj tytuł (usuń emoji, śmieci)
        const titleResult = await aiNormalizeTitlePL({
          title: product.title || '',
          language: 'en'
        });
        const normalizedTitle = titleResult.normalizedTitle;
        
        // 2. Wzbogać opis (tłumaczenie + SEO)
        const enrichResult = await aiProductEnrichmentPL({
          originalTitle: normalizedTitle,
          rawDescription: product.descriptionHtml || product.description || undefined,
          categoryPath: [mainCategory || 'inne', subCategory || 'inne'],
          price: price,
          originalPrice: originalPrice || undefined,
          rating: Number(product.rating || 0),
          orders: Number(product.orders || 0),
          merchant: product.merchant || undefined
        });
        
        // Update produktu z AI danymi
        await docRef.update({
          name: enrichResult.normalizedName,
          description: enrichResult.shortDescription,
          longDescription: enrichResult.longDescription,
          features: enrichResult.features || [],
          tags: enrichResult.keywords || [],
          'metadata.aiEnriched': true,
          'metadata.aiEnrichedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        
        console.log(`[import] AI enrichment completed for product ${docRef.id}`);
      } catch (aiError) {
        console.error(`[import] AI enrichment failed for product ${docRef.id}:`, aiError);
        // Nie rzucaj błędu - produkt już jest zapisany
      }
    })();

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e) {
    console.error('Import product failed:', e);
    return NextResponse.json({ error: 'import_failed', message: String(e) }, { status: 500 });
  }
}
