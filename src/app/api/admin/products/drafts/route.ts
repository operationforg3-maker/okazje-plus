import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { ProductCore } from '@/lib/types';

/**
 * GET /api/admin/products/drafts
 * Returns all draft products awaiting moderation
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch draft products, sorted by creation date (newest first)
    const snapshot = await adminDb.collection('product_cores')
      .where('status', '==', 'draft')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const products: ProductCore[] = [];
    snapshot.forEach(doc => {
      products.push({
        ...(doc.data() as ProductCore),
        id: doc.id,
      });
    });

    return NextResponse.json({
      success: true,
      products,
      count: products.length,
    });
  } catch (error) {
    console.error('Error fetching draft products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft products', details: (error as Error).message },
      { status: 500 }
    );
  }
}
