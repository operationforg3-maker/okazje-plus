import { NextRequest, NextResponse } from 'next/server';
import { requireModerator } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const parseStatuses = (value: string | null, fallback: string[]) => {
  if (!value) return fallback;
  if (value === 'all') return fallback;
  return value.split(',').map(s => s.trim()).filter(Boolean);
};

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value.toDate) return value.toDate().getTime();
  return 0;
};

export async function GET(request: NextRequest) {
  try {
    await requireModerator();

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '200', 10));

    const dealStatuses = parseStatuses(searchParams.get('dealStatuses'), ['pending', 'draft']);
    const productStatuses = parseStatuses(searchParams.get('productStatuses'), ['pending_approval', 'draft']);
    const includeRecent = searchParams.get('includeRecent') !== '0';

    const perDealLimit = Math.ceil(limit / Math.max(1, dealStatuses.length));
    const perProductLimit = Math.ceil(limit / Math.max(1, productStatuses.length));

    const dealQueries = await Promise.all(
      dealStatuses.map(status =>
        adminDb
          .collection('deals')
          .where('status', '==', status)
          .limit(perDealLimit)
          .get()
      )
    );

    const deals = dealQueries
      .flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      .sort((a, b) => toMillis(b.postedAt || b.createdAt) - toMillis(a.postedAt || a.createdAt))
      .slice(0, limit);

    const productQueries = await Promise.all(
      productStatuses.map(status =>
        adminDb
          .collection('product_cores')
          .where('status', '==', status)
          .limit(perProductLimit)
          .get()
      )
    );

    const products = productQueries
      .flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      .sort((a, b) => toMillis(b.metadata?.importedAt || b.createdAt) - toMillis(a.metadata?.importedAt || a.createdAt))
      .slice(0, limit);

    let approved: any[] = [];
    let rejected: any[] = [];

    if (includeRecent) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffMs = cutoff.getTime();

      const [approvedDealsSnap, approvedProductsSnap, rejectedDealsSnap, rejectedProductsSnap] = await Promise.all([
        adminDb.collection('deals').where('status', '==', 'approved').limit(100).get(),
        adminDb.collection('product_cores').where('status', '==', 'approved').limit(100).get(),
        adminDb.collection('deals').where('status', '==', 'rejected').limit(100).get(),
        adminDb.collection('product_cores').where('status', '==', 'rejected').limit(100).get(),
      ]);

      const mapRecent = (snap: FirebaseFirestore.QuerySnapshot, type: 'deal' | 'product') =>
        snap.docs
          .map(doc => ({ id: doc.id, type, ...doc.data() } as any))
          .filter((item: any) => {
            const updatedAt = item.updatedAt?.toDate?.() || (item.updatedAt ? new Date(item.updatedAt) : new Date(0));
            return updatedAt.getTime() >= cutoffMs;
          });

      approved = [...mapRecent(approvedDealsSnap, 'deal'), ...mapRecent(approvedProductsSnap, 'product')];
      rejected = [...mapRecent(rejectedDealsSnap, 'deal'), ...mapRecent(rejectedProductsSnap, 'product')];
    }

    return NextResponse.json({
      success: true,
      deals,
      products,
      approved,
      rejected,
    });
  } catch (error: any) {
    console.error('[Moderation Data API] Error:', error);
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Unauthorized/Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
