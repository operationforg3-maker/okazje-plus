import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import typesenseServerClient from '@/lib/typesense-server';
import { cacheGet, cacheSet } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

const PUBLIC_STATS_CACHE_KEY = 'public:stats:v3';
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

    // final.md: public offer reads should use Typesense (not Firestore).
    const usersTotalPromise = adminDb.collection('users').count().get();

    if (!typesenseServerClient) {
      const [usersTotal, approvedDeals, approvedProductCores] = await Promise.all([
        usersTotalPromise,
        adminDb.collection('deals').where('status', '==', 'approved').count().get(),
        adminDb.collection('product_cores').where('status', '==', 'approved').count().get(),
      ]);

      const payload = {
        success: true,
        dealsCount: approvedDeals.data().count,
        productsCount: approvedProductCores.data().count,
        usersCount: usersTotal.data().count,
        totalSavings: 0,
        source: 'firestore_fallback',
        timestamp: new Date().toISOString(),
      };

      await cacheSet(PUBLIC_STATS_CACHE_KEY, payload, PUBLIC_STATS_TTL_SECONDS);
      return NextResponse.json(payload, {
        headers: {
          'Cache-Control': PUBLIC_CACHE_CONTROL,
        },
      });
    }

    const [approvedDeals, approvedProductCores, pendingProductCores, usersTotal] = await Promise.all([
      typesenseServerClient.collections('deals').documents().search({
        q: '*',
        query_by: 'title,description,postedBy',
        filter_by: 'status:=approved',
        per_page: 1,
      }, {}),
      adminDb.collection('product_cores').where('status', '==', 'approved').count().get(),
      adminDb.collection('product_cores').where('status', '==', 'pending_approval').count().get(),
      usersTotalPromise,
    ]);

    const totalApprovedDeals = Math.max(0, Number((approvedDeals as any).found || 0));

    // Keep this lightweight for home page TTFB: estimate from top 250 deals only.
    let totalSavings = 0;
    const savingsSampleRes = await typesenseServerClient.collections('deals').documents().search({
      q: '*',
      query_by: 'title,description,postedBy',
      filter_by: 'status:=approved',
      sort_by: 'voteCount:desc',
      per_page: 250,
      page: 1,
    }, {});

    const savingsHits = ((savingsSampleRes as any).hits || []) as Array<{ document?: Record<string, unknown> }>;
    totalSavings = savingsHits.reduce((sum, hit) => {
      const voteCount = Number((hit.document?.voteCount as number | undefined) ?? 0);
      return sum + (Number.isFinite(voteCount) ? voteCount : 0) * 10;
    }, 0);

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
