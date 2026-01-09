import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { nanoid } from 'nanoid';

/**
 * POST /api/cart/share
 * Zapisuje koszyk i generuje unikalny link do udostępnienia
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, userId, userName, userEmail } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid items - cart is empty' },
        { status: 400 }
      );
    }

    // Generate unique ID for shared cart
    const shareId = nanoid(12); // 12-character unique ID

    // Calculate totals
    const totalAmount = items.reduce((sum: number, item: any) => {
      const price = typeof item.product.price === 'number' 
        ? item.product.price 
        : item.product.price?.amount || 0;
      return sum + (price * item.quantity);
    }, 0);

    const totalWithShipping = items.reduce((sum: number, item: any) => {
      const totalPrice = typeof item.product.price === 'number'
        ? item.product.price
        : item.product.price?.totalPrice || item.product.price?.amount || 0;
      return sum + (totalPrice * item.quantity);
    }, 0);

    const itemCount = items.reduce((sum: number, item: any) => sum + item.quantity, 0);

    // Save to Firestore
    await adminDb.collection('shared_carts').doc(shareId).set({
      shareId,
      items: items.map((item: any) => ({
        productId: item.product.id,
        productName: item.product.name || item.product.title?.pl || item.product.title,
        productImage: item.product.image,
        productPrice: typeof item.product.price === 'number' 
          ? item.product.price 
          : item.product.price?.amount || 0,
        affiliateUrl: item.product.affiliateUrl,
        quantity: item.quantity,
        notes: item.notes || null,
      })),
      metadata: {
        itemCount,
        totalAmount,
        totalWithShipping,
        createdBy: userId || 'guest',
        createdByName: userName || 'Gość',
        createdByEmail: userEmail || null,
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dni
      views: 0,
      status: 'active',
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002';
    const shareUrl = `${siteUrl}/cart/shared/${shareId}`;

    return NextResponse.json({
      success: true,
      shareId,
      shareUrl,
      itemCount,
      totalAmount,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('[Share Cart] Error:', error);
    return NextResponse.json(
      { error: 'Failed to share cart', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cart/share?id=xxx
 * Pobiera udostępniony koszyk
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shareId = searchParams.get('id');

    if (!shareId) {
      return NextResponse.json(
        { error: 'Missing share ID' },
        { status: 400 }
      );
    }

    const cartDoc = await adminDb.collection('shared_carts').doc(shareId).get();

    if (!cartDoc.exists) {
      return NextResponse.json(
        { error: 'Shared cart not found or expired' },
        { status: 404 }
      );
    }

    const cartData = cartDoc.data();

    // Check if expired
    const expiresAt = new Date(cartData!.expiresAt);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Shared cart has expired' },
        { status: 410 }
      );
    }

    // Increment view counter
    await adminDb.collection('shared_carts').doc(shareId).update({
      views: (cartData!.views || 0) + 1,
      lastViewedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      cart: cartData,
    });
  } catch (error: any) {
    console.error('[Get Shared Cart] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load shared cart', details: error.message },
      { status: 500 }
    );
  }
}
