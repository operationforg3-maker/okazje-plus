import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/deals/by-product?productId=xyz
 * 
 * Pobiera deals powiązane z ProductCore
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const productId = request.nextUrl.searchParams.get('productId');
    if (!productId) {
      return NextResponse.json(
        { error: 'productId query param required' },
        { status: 400 }
      );
    }

    const snapshot = await adminDb
      .collection('deals')
      .where('productCoreId', '==', productId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const deals = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      productId,
      count: deals.length,
      deals,
    });
  } catch (error: any) {
    console.error('[Deals by Product] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}
