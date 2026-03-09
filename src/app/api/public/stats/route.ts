import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import typesenseServerClient from '@/lib/typesense-server';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    // final.md: public offer reads should use Typesense (not Firestore).
    const usersTotalPromise = adminDb.collection('users').count().get();

    if (!typesenseServerClient) {
      const usersTotal = await usersTotalPromise;
      return NextResponse.json({
        success: false,
        dealsCount: 0,
        productsCount: 0,
        usersCount: usersTotal.data().count,
        totalSavings: 0,
        error: 'Typesense unavailable',
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }

    const [approvedDeals, approvedProducts, usersTotal] = await Promise.all([
      typesenseServerClient.collections('deals').documents().search({
        q: '*',
        query_by: 'title,description,postedBy',
        filter_by: 'status:=approved',
        per_page: 1,
      }, {}),
      typesenseServerClient.collections('products').documents().search({
        q: '*',
        query_by: 'name,description',
        filter_by: 'status:=approved',
        per_page: 1,
      }, {}),
      usersTotalPromise,
    ]);

    // Approximate savings from up to 5000 approved deals in Typesense (votes * 10 PLN).
    const totalApprovedDeals = Math.max(0, Number((approvedDeals as any).found || 0));
    const maxDealsForSavings = Math.min(totalApprovedDeals, 5000);
    const perPage = 250;
    const maxPages = Math.ceil(maxDealsForSavings / perPage);
    let totalSavings = 0;

    for (let page = 1; page <= maxPages; page++) {
      const pageRes = await typesenseServerClient.collections('deals').documents().search({
        q: '*',
        query_by: 'title,description,postedBy',
        filter_by: 'status:=approved',
        sort_by: 'voteCount:desc',
        per_page: perPage,
        page,
      }, {});

      const hits = ((pageRes as any).hits || []) as Array<{ document?: Record<string, unknown> }>;
      totalSavings += hits.reduce((sum, hit) => {
        const voteCount = Number((hit.document?.voteCount as number | undefined) ?? 0);
        return sum + (Number.isFinite(voteCount) ? voteCount : 0) * 10;
      }, 0);
    }

    return NextResponse.json({
      success: true,
      dealsCount: totalApprovedDeals,
      productsCount: Math.max(0, Number((approvedProducts as any).found || 0)),
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
