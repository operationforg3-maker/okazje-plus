import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { isAdminUser } from '@/lib/auth-server';
import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const idToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
    const allowed = await isAdminUser(idToken);
    if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await request.json();
    const { product, mainCategory, subCategory, subSubCategory } = body;

    if (!product?.title || !mainCategory || !subCategory) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const app = initializeFirebaseAdmin();
    const db = admin.firestore();
    const decoded = idToken ? await admin.auth().verifyIdToken(idToken) : null;

    // Check for duplicates by ASIN
    const externalId = product.asin || null;
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
      name: product.title,
      description: product.description || '',
      longDescription: product.description || '',
      price: parseFloat(product.price) || 0,
      originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : undefined,
      discountPercent: product.originalPrice && product.price 
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0,
      image: product.imageUrl || '',
      imageHint: product.title,
      affiliateUrl: product.productUrl || '',
      mainCategorySlug: mainCategory,
      subCategorySlug: subCategory,
      subSubCategorySlug: subSubCategory || undefined,
      status: 'draft',
      rating: product.rating || 0,
      soldCount: 0,
      merchantRating: 0,
      merchant: product.merchant || '',
      gallery: product.imageUrl ? [
        {
          id: `amazon_${product.asin}_0`,
          src: product.imageUrl,
          alt: product.title,
          isPrimary: true,
          source: 'manual' as const,
          type: 'url' as const,
          addedAt: new Date().toISOString(),
        }
      ] : [],
      ratingCard: {
        average: product.rating || 0,
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
    console.error('Amazon import error:', error);
    return NextResponse.json(
      { error: error.message || 'import_failed' },
      { status: 500 }
    );
  }
}
