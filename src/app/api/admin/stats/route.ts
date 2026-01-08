import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/auth-server';

export async function GET() {
  // Ensure only admins can access — separate try for auth
  let session;
  try {
    session = await requireAdmin();
  } catch (authError) {
    const message = (authError as any)?.message || '';
    const isUnauthorized = typeof message === 'string' && message.includes('Unauthorized');
    const status = isUnauthorized ? 401 : 403;
    return NextResponse.json(
      {
        success: false,
        error: isUnauthorized ? 'Nieautoryzowany' : 'Brak uprawnień',
      },
      { status }
    );
  }

  try {
    // Time window
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last24Ts = Timestamp.fromDate(last24Hours);

    // Approved counts with fallback (M6: product_cores)
    let approvedDeals, approvedProducts, usersTotal;
    try {
      [approvedDeals, approvedProducts, usersTotal] = await Promise.all([
        adminDb.collection('deals').where('status', '==', 'approved').count().get(),
        adminDb.collection('product_cores').where('status', '==', 'approved').count().get(),
        adminDb.collection('users').count().get(),
      ]);
    } catch (err) {
      console.warn('[Admin Stats API] Approved counts error:', err);
      approvedDeals = { data: () => ({ count: 0 }) };
      approvedProducts = { data: () => ({ count: 0 }) };
      usersTotal = { data: () => ({ count: 0 }) };
    }

    // Pending/draft counts with fallback
    let pendingDeals, draftDeals, pendingProducts, draftProducts;
    try {
      [pendingDeals, draftDeals, pendingProducts, draftProducts] = await Promise.all([
        adminDb.collection('deals').where('status', '==', 'pending').count().get(),
        adminDb.collection('deals').where('status', '==', 'draft').count().get(),
        adminDb.collection('product_cores').where('status', '==', 'pending_approval').count().get(),
        adminDb.collection('product_cores').where('status', '==', 'draft').count().get(),
      ]);
    } catch (err) {
      console.warn('[Admin Stats API] Pending counts error:', err);
      pendingDeals = { data: () => ({ count: 0 }) };
      draftDeals = { data: () => ({ count: 0 }) };
      pendingProducts = { data: () => ({ count: 0 }) };
      draftProducts = { data: () => ({ count: 0 }) };
    }

    // New items in last 24h with fallback
    let newDeals24h, newUsers24h;
    try {
      [newDeals24h, newUsers24h] = await Promise.all([
        adminDb.collection('deals').where('createdAt', '>=', last24Ts).count().get(),
        adminDb.collection('users').where('createdAt', '>=', last24Ts).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      ]);
    } catch (err) {
      console.warn('[Admin Stats API] Recent 24h error:', err);
      newDeals24h = { data: () => ({ count: 0 }) };
      newUsers24h = { data: () => ({ count: 0 }) };
    }

    // Engagement proxy with fallback
    let totalSavings = 0;
    try {
      const dealsSnapshot = await adminDb.collection('deals')
        .select('vote_count')
        .get();
      totalSavings = dealsSnapshot.docs.reduce((sum, doc) => {
        const votes = (doc.data() as any).vote_count || 0;
        return sum + votes * 10;
      }, 0);
    } catch (err) {
      console.warn('[Admin Stats API] Total savings error:', err);
      totalSavings = 0;
    }

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
    console.error('[Admin Stats API] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Błąd serwera',
        // Fallback with zero stats
        totals: { products: 0, deals: 0, users: 0 },
        pending: { deals: 0, products: 0 },
        recent24h: { deals: 0, users: 0 },
        totalSavings: 0,
      },
      { status: 500 }
    );
  }
}

export const revalidate = 120; // Cache for 2 minutes
