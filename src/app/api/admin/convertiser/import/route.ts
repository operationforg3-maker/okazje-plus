import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getConvertiserClient } from '@/lib/integrations/convertiser-client';

async function isAdminUser(idToken: string | null) {
  if (!idToken) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if ((decoded as any).admin) return true;
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
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

    const decoded = idToken ? await adminAuth.verifyIdToken(idToken) : null;
    const externalId = product.uuid || product.id || null;

    // Check for duplicate product
    if (externalId) {
      const existingQuery = await adminDb
        .collection('products')
        .where('metadata.originalId', '==', externalId)
        .where('metadata.source', '==', 'convertiser')
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        return NextResponse.json(
          { error: 'duplicate_product', existingId: existingQuery.docs[0].id },
          { status: 409 }
        );
      }
    }

    // Resolve tracking link if needed
    let trackingUrl = product.affiliateUrl || product.url || product.direct_link || '';
    if (!trackingUrl && product.uuid) {
      try {
        const client = getConvertiserClient();
        const trackingRes = await client.generateProductTrackingLink(product.uuid);
        if (trackingRes?.tracking_link || trackingRes?.url) {
          trackingUrl = trackingRes.tracking_link || trackingRes.url;
        }
      } catch {
        // fallback
      }
    }
    if (!trackingUrl && product.offerUuid) {
      try {
        const client = getConvertiserClient();
        const offerDetail = await client.getOfferDetail(product.offerUuid);
        if (offerDetail?.tracking_link) {
          trackingUrl = offerDetail.tracking_link;
        }
      } catch {
        // fallback
      }
    }
    if (!trackingUrl) {
      trackingUrl = product.url || `https://convertiser.com/products/${externalId || 'manual'}/`;
    }

    const merchantName = product.advertiser || product.merchant || 'Partner Convertiser';
    const priceNum = parseFloat(product.price) || 0;
    const origPriceNum = parseFloat(product.originalPrice) || 0;
    const discountPercent = origPriceNum > priceNum ? Math.round(((origPriceNum - priceNum) / origPriceNum) * 100) : 0;

    // 1. Create Product Document
    const productDoc = {
      name: product.name,
      description: product.description || product.name,
      longDescription: product.description || product.name,
      price: priceNum,
      originalPrice: origPriceNum > priceNum ? origPriceNum : undefined,
      discountPercent,
      image: product.image || '',
      imageHint: product.name,
      affiliateUrl: trackingUrl,
      mainCategorySlug: mainCategory,
      subCategorySlug: subCategory,
      subSubCategorySlug: subSubCategory || undefined,
      status: 'approved',
      rating: 0,
      soldCount: 0,
      merchantRating: 0,
      merchant: merchantName,
      gallery: product.image ? [
        {
          id: `convertiser_${externalId || 'img'}_0`,
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
        source: 'convertiser',
        originalId: externalId,
        importedAt: new Date().toISOString(),
        importedBy: decoded?.uid || 'system',
        convertiserCommission: product.commission,
        convertiserAdvertiser: merchantName,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('products').add(productDoc);

    // 2. Create Deal Document (Matching AliExpress dual collection pattern)
    const dealDoc = {
      productId: docRef.id,
      mainCategorySlug: mainCategory,
      subCategorySlug: subCategory,
      subSubCategorySlug: subSubCategory || undefined,
      price: {
        amount: priceNum,
        currency: 'PLN',
      },
      originalPrice: origPriceNum > priceNum ? origPriceNum : undefined,
      shipping: {
        cost: 0,
        fromCountry: 'PL',
      },
      source: 'convertiser' as const,
      affiliateLink: trackingUrl,
      link: trackingUrl,
      affiliateUrl: trackingUrl,
      dealUrl: trackingUrl,
      merchantName,
      title: { pl: product.name },
      dealType: 'deal' as const,
      freeShipping: false,
      stockStatus: 'in_stock' as const,
      isActive: true,
      priceHistory: [
        {
          date: new Date().toISOString().split('T')[0],
          price: priceNum,
          currency: 'PLN',
        },
      ],
      voteCount: 0,
      temperature: 0,
      commentsCount: 0,
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: decoded?.uid || 'system',
      sourceProductId: externalId || '',
      sourceUrl: trackingUrl,
      metadata: {
        source: 'convertiser',
        originalId: externalId,
        importedAt: new Date().toISOString(),
        importedBy: decoded?.uid || 'system',
        merchant: merchantName,
      },
    };

    const dealRef = await adminDb.collection('deals').add(dealDoc);

    return NextResponse.json({
      success: true,
      productId: docRef.id,
      dealId: dealRef.id,
    });
  } catch (error: any) {
    console.error('Convertiser import error:', error);
    return NextResponse.json(
      { error: error.message || 'import_failed' },
      { status: 500 }
    );
  }
}
