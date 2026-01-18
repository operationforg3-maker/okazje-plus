import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    // Public stats - no auth required
    const [approvedDeals, approvedProducts, usersTotal] = await Promise.all([
      adminDb.collection('deals').where('status', '==', 'approved').count().get(),
      adminDb.collection('product_cores').where('status', '==', 'approved').count().get(),
      adminDb.collection('users').count().get(),
    ]);

    // Calculate approximate savings (votes * 10 PLN per vote)
    const dealsSnapshot = await adminDb.collection('deals')
      .where('status', '==', 'approved')
      .select('vote_count')
      .limit(5000) // Limit for performance
      .get();
    
    const totalSavings = dealsSnapshot.docs.reduce((sum, doc) => {
      const votes = (doc.data() as any).vote_count || 0;
      return sum + votes * 10;
    }, 0);

    return NextResponse.json({
      success: true,
      dealsCount: approvedDeals.data().count,
      productsCount: approvedProducts.data().count,
      usersCount: usersTotal.data().count,
      totalSavings: Math.round(totalSavings),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Public Stats API] Error:', error);
    return NextResponse.json({
      success: false,
      dealsCount: 0,
      productsCount: 0,
      usersCount: 0,
      totalSavings: 0,
      error: 'Failed to fetch stats',
    }, { status: 500 });
  }
}
