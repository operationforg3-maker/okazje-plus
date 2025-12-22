import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/product-cores/recent
 * 
 * Pobiera najnowsze ProductCores z Firestore
 * Query params:
 * - limit: number (default 20, max 100)
 * - status: string (optional filter: draft, pending_approval, approved)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
    const status = searchParams.get('status');

    let q: FirebaseFirestore.Query = adminDb.collection('product_cores');
    
    if (status) {
      q = q.where('status', '==', status);
    }

    q = q.orderBy('createdAt', 'desc').limit(limit);
    const snapshot = await q.get();

    const products = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    return NextResponse.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error: any) {
    console.error('[Product Cores Recent] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch product cores' },
      { status: 500 }
    );
  }
}
