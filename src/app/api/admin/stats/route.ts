import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/auth-server';

export async function GET() {
  try {
    // Ensure only admins can access
    await requireAdmin();

    // Time window
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last24Ts = Timestamp.fromDate(last24Hours);

    // Approved counts (M6: product_cores)
    const [approvedDeals, approvedProducts, usersTotal] = await Promise.all([
      adminDb.collection('deals').where('status', '==', 'approved').count().get(),
      adminDb.collection('product_cores').where('status', '==', 'approved').count().get(),
      adminDb.collection('users').count().get(),
    ]);

    // Pending/draft counts
    const [pendingDeals, draftDeals, pendingProducts, draftProducts] = await Promise.all([
      adminDb.collection('deals').where('status', '==', 'pending').count().get(),
      adminDb.collection('deals').where('status', '==', 'draft').count().get(),
      adminDb.collection('product_cores').where('status', '==', 'pending_approval').count().get(),
      adminDb.collection('product_cores').where('status', '==', 'draft').count().get(),
    ]);

    // New items in last 24h
    const [newDeals24h, newUsers24h] = await Promise.all([
      adminDb.collection('deals').where('createdAt', '>=', last24Ts).count().get(),
      adminDb.collection('users').where('createdAt', '>=', last24Ts).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
    ]);

    // Engagement proxy
    const dealsSnapshot = await adminDb.collection('deals')
      .select('vote_count')
      .get();
    const totalSavings = dealsSnapshot.docs.reduce((sum, doc) => {
      const votes = (doc.data() as any).vote_count || 0;
      return sum + votes * 10; // Estimate 10 PLN per vote
    }, 0);

    return NextResponse.json({
      success: true,
      totals: {
        products: approvedProducts.data().count,
        deals: approvedDeals.data().count,
        users: usersTotal.data().count,
      },
      pending: {
        deals: pendingDeals.data().count + draftDeals.data().count,
        products: pendingProducts.data().count + draftProducts.data().count,
      },
      recent24h: {
        deals: newDeals24h.data().count,
        users: newUsers24h.data().count,
      },
      totalSavings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin Stats API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch admin stats',
    }, { status: 500 });
  }
}

export const revalidate = 120; // Cache for 2 minutes
