import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { cacheGet, cacheSet } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

const PUBLIC_STATS_CACHE_KEY = 'public:stats:v4';
const PUBLIC_STATS_TTL_SECONDS = 300;
const PUBLIC_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600';

export async function GET() {
  try {
    const cached = await cacheGet(PUBLIC_STATS_CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': PUBLIC_CACHE_CONTROL,
        },
      });
    }

    const usersTotalPromise = adminDb.collection('users').count().get();

    const [approvedDealsFirestore, approvedProductCores, pendingProductCores, usersTotal] = await Promise.all([
      adminDb.collection('deals').where('status', '==', 'approved').count().get(),
      adminDb.collection('product_cores').where('status', '==', 'approved').count().get(),
      adminDb.collection('product_cores').where('status', '==', 'pending_approval').count().get(),
      usersTotalPromise,
    ]);

    const totalApprovedDeals = approvedDealsFirestore.data().count;
    let totalSavings = 0;

    try {
      const topDealsSnap = await adminDb.collection('deals')
        .where('status', '==', 'approved')
        .orderBy('voteCount', 'desc')
        .limit(250)
        .get();

      totalSavings = topDealsSnap.docs.reduce((sum: number, doc: any) => {
        const voteCount = Number(doc.data().voteCount ?? 0);
        return sum + (Number.isFinite(voteCount) ? voteCount : 0) * 10;
      }, 0);
    } catch (savingsError) {
      console.warn('[Public Stats API] Failed to compute savings from Firestore:', savingsError);
    }

    const totalApprovedProducts = approvedProductCores.data().count + pendingProductCores.data().count;

    const payload = {
      success: true,
      dealsCount: totalApprovedDeals,
      productsCount: totalApprovedProducts,
      usersCount: usersTotal.data().count,
      totalSavings: Math.round(totalSavings),
      productsCountSource: 'product_cores_only',
      timestamp: new Date().toISOString(),
    };

    await cacheSet(PUBLIC_STATS_CACHE_KEY, payload, PUBLIC_STATS_TTL_SECONDS);
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': PUBLIC_CACHE_CONTROL,
      },
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
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}
