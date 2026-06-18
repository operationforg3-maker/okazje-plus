import { NextRequest, NextResponse } from 'next/server';
import { requireModerator } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { sanitizeDealRecord, sanitizeProductCoreRecord } from '@/lib/sanitizers';

export const dynamic = 'force-dynamic';

const parseStatuses = (value: string | null, fallback: string[]) => {
  if (!value) return fallback;
  if (value === 'all') return fallback;
  const list = value.split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes('pending') && !list.includes('poczekalnia')) {
    list.push('poczekalnia');
  }
  return list;
};

const toMillis = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value.toDate) return value.toDate().getTime();
  return 0;
};

const toSanitizedDeal = (doc: FirebaseFirestore.QueryDocumentSnapshot) =>
  sanitizeDealRecord(doc.data(), doc.id);

const toSanitizedProductCore = (doc: FirebaseFirestore.QueryDocumentSnapshot) =>
  sanitizeProductCoreRecord(doc.data(), doc.id);

export async function GET(request: NextRequest) {
  try {
    await requireModerator();

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '200', 10));

    const dealStatuses = parseStatuses(searchParams.get('dealStatuses'), ['pending', 'poczekalnia', 'draft']);
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
      .flatMap((snap) => snap.docs.map(toSanitizedDeal))
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
      .flatMap((snap) => snap.docs.map(toSanitizedProductCore))
      .filter((item: any) => !(item?.metadata?.offerOnly))
      .sort((a, b) => toMillis(b.metadata?.importedAt || b.createdAt) - toMillis(a.metadata?.importedAt || a.createdAt))
      .slice(0, limit);

    let approved: any[] = [];
    let rejected: any[] = [];
    let discarded: any[] = [];

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
          .map((doc) => {
            const item = type === 'deal'
              ? toSanitizedDeal(doc as FirebaseFirestore.QueryDocumentSnapshot)
              : toSanitizedProductCore(doc as FirebaseFirestore.QueryDocumentSnapshot);

            return { ...item, type } as any;
          })
          .filter((item: any) => {
            const updatedAt = item.updatedAt?.toDate?.() || (item.updatedAt ? new Date(item.updatedAt) : new Date(0));
            return updatedAt.getTime() >= cutoffMs;
          });

      const approvedProducts = mapRecent(approvedProductsSnap, 'product').filter((item: any) => !(item?.metadata?.offerOnly));
      const rejectedProducts = mapRecent(rejectedProductsSnap, 'product').filter((item: any) => !(item?.metadata?.offerOnly));
      approved = [...mapRecent(approvedDealsSnap, 'deal'), ...approvedProducts];
      rejected = [...mapRecent(rejectedDealsSnap, 'deal'), ...rejectedProducts];
    }

    const discardedSnap = await adminDb
      .collection('import_discarded')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    discarded = discardedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      success: true,
      deals,
      products,
      approved,
      rejected,
      discarded,
    });
  } catch (error: any) {
    console.error('[Moderation Data API] Error:', error);
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Unauthorized/Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
