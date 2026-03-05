import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getConvertiserClient } from '@/lib/integrations/convertiser-client';

const COLLECTION_NAME = 'affiliate_purchases_aliexpress';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SCAN_PAGES = 3;
const DEFAULT_SCAN_PAGE_SIZE = 100;
const MAX_FALLBACK_RECORDS = 5000;

type NormalizedPurchase = {
  id: string;
  transactionId: string;
  orderId: string | null;
  advertiser: string;
  status: string;
  purchaseAmount: number;
  commissionAmount: number;
  currency: string;
  purchaseDate: string;
  purchaseDateMs: number;
  website: string | null;
  clickId: string | null;
  source: 'convertiser';
  updatedAt: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function firstString(raw: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function toIsoDate(value: unknown): string {
  if (!value) return new Date(0).toISOString();

  if (typeof value === 'number') {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
  }

  return new Date(0).toISOString();
}

function hasAliExpressMarker(raw: Record<string, any>): boolean {
  const candidates = [
    raw.advertiser,
    raw.advertiser_name,
    raw.offer_name,
    raw.campaign_name,
    raw.merchant,
    raw.merchant_name,
    raw.store_name,
    raw.program_name,
    raw.offer?.advertiser,
    raw.offer?.advertiser_name,
  ]
    .filter((item) => typeof item === 'string')
    .map((item) => String(item).toLowerCase());

  if (candidates.some((value) => value.includes('aliexpress'))) {
    return true;
  }

  try {
    return JSON.stringify(raw).toLowerCase().includes('aliexpress');
  } catch {
    return false;
  }
}

function isCompletedPurchase(raw: Record<string, any>): boolean {
  const statusRaw = firstString(raw, ['status', 'transaction_status', 'order_status', 'state']) || '';
  const status = statusRaw.toLowerCase();

  if (!status) return true;

  const failedMarkers = ['cancel', 'reject', 'denied', 'failed', 'fraud', 'void'];
  if (failedMarkers.some((marker) => status.includes(marker))) return false;

  const pendingMarkers = ['pending', 'processing', 'new', 'open', 'hold', 'waiting'];
  if (pendingMarkers.some((marker) => status.includes(marker))) return false;

  const completedMarkers = ['complete', 'approved', 'accepted', 'confirm', 'paid', 'settled', 'done'];
  if (completedMarkers.some((marker) => status.includes(marker))) return true;

  return true;
}

function normalizePurchase(raw: Record<string, any>, index: number): NormalizedPurchase {
  const transactionId = String(
    raw.id ?? raw.uuid ?? raw.transaction_id ?? raw.transactionId ?? `unknown-${Date.now()}-${index}`
  );

  const orderId = firstString(raw, ['order_id', 'orderId', 'sale_id', 'external_order_id']);
  const advertiser =
    firstString(raw, ['advertiser_name', 'advertiser', 'merchant_name', 'merchant', 'offer_name']) ||
    'AliExpress';
  const status = firstString(raw, ['status', 'transaction_status', 'order_status', 'state']) || 'unknown';

  const purchaseAmount = parseNumber(
    raw.order_amount ?? raw.sale_amount ?? raw.transaction_amount ?? raw.purchase_amount ?? raw.amount
  );

  const commissionAmount = parseNumber(raw.commission ?? raw.commission_amount ?? raw.publisher_commission ?? 0);

  const currency =
    firstString(raw, ['currency', 'currency_code', 'order_currency', 'sale_currency']) ||
    'PLN';

  const purchaseDate = toIsoDate(
    raw.date ?? raw.transaction_date ?? raw.created_at ?? raw.createdAt ?? raw.event_time
  );

  const purchaseDateMs = new Date(purchaseDate).getTime();
  const nowIso = new Date().toISOString();

  return {
    id: transactionId.replace(/[^a-zA-Z0-9_-]/g, '_'),
    transactionId,
    orderId,
    advertiser,
    status,
    purchaseAmount,
    commissionAmount,
    currency,
    purchaseDate,
    purchaseDateMs: Number.isFinite(purchaseDateMs) ? purchaseDateMs : 0,
    website: firstString(raw, ['website_name', 'website', 'publisher_website']),
    clickId: firstString(raw, ['click_id', 'clickId', 'subid', 'sub_id']),
    source: 'convertiser',
    updatedAt: nowIso,
  };
}

async function verifyAdminToken(request: NextRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Brak tokenu autoryzacyjnego' };
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const role = userDoc.data()?.role;
    const isAdmin = decoded.admin === true || role === 'admin';

    if (!isAdmin) {
      return { ok: false, status: 403, error: 'Brak uprawnień administratora' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 401, error: 'Nieprawidłowy token' };
  }
}

async function savePurchasesToFirestore(purchases: NormalizedPurchase[]): Promise<void> {
  if (!purchases.length) return;

  const chunkSize = 400;
  for (let start = 0; start < purchases.length; start += chunkSize) {
    const chunk = purchases.slice(start, start + chunkSize);
    const batch = adminDb.batch();

    for (const purchase of chunk) {
      const docRef = adminDb.collection(COLLECTION_NAME).doc(purchase.id);
      batch.set(docRef, purchase, { merge: true });
    }

    await batch.commit();
  }

  await adminDb.collection('admin_meta').doc('aliexpress-affiliate-purchases').set(
    {
      lastSyncAt: new Date().toISOString(),
      records: purchases.length,
      source: 'convertiser',
    },
    { merge: true }
  );
}

async function loadAllPurchasesFromFirestore(): Promise<NormalizedPurchase[]> {
  const snap = await adminDb
    .collection(COLLECTION_NAME)
    .orderBy('purchaseDateMs', 'desc')
    .limit(MAX_FALLBACK_RECORDS)
    .get();

  return snap.docs.map((doc: any) => doc.data() as NormalizedPurchase);
}

function buildTrackingIds(purchases: NormalizedPurchase[]): string[] {
  return Array.from(
    new Set(
      purchases
        .map((purchase) => purchase.clickId)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function buildSummary(purchases: NormalizedPurchase[]) {
  const statusBreakdown: Record<string, number> = {};
  const currencyBreakdown: Record<string, number> = {};
  let totalPurchaseAmount = 0;
  let totalCommissionAmount = 0;

  const nowMs = Date.now();
  const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;

  let purchases24h = 0;
  let purchases7d = 0;
  let commission24h = 0;
  let commission7d = 0;
  let withTrackingIdCount = 0;
  const trackingStats: Record<string, { count: number; commission: number; purchaseAmount: number }> = {};

  for (const purchase of purchases) {
    const statusKey = purchase.status || 'unknown';
    statusBreakdown[statusKey] = (statusBreakdown[statusKey] || 0) + 1;

    const currencyKey = purchase.currency || 'PLN';
    currencyBreakdown[currencyKey] = (currencyBreakdown[currencyKey] || 0) + purchase.commissionAmount;

    totalPurchaseAmount += purchase.purchaseAmount;
    totalCommissionAmount += purchase.commissionAmount;

    if (purchase.purchaseDateMs >= oneDayAgo) {
      purchases24h += 1;
      commission24h += purchase.commissionAmount;
    }

    if (purchase.purchaseDateMs >= sevenDaysAgo) {
      purchases7d += 1;
      commission7d += purchase.commissionAmount;
    }

    if (purchase.clickId) {
      withTrackingIdCount += 1;
      if (!trackingStats[purchase.clickId]) {
        trackingStats[purchase.clickId] = { count: 0, commission: 0, purchaseAmount: 0 };
      }
      trackingStats[purchase.clickId].count += 1;
      trackingStats[purchase.clickId].commission += purchase.commissionAmount;
      trackingStats[purchase.clickId].purchaseAmount += purchase.purchaseAmount;
    }
  }

  const primaryCurrency = Object.entries(currencyBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || 'PLN';
  const averageOrderValue = purchases.length ? totalPurchaseAmount / purchases.length : 0;
  const averageCommissionPerOrder = purchases.length ? totalCommissionAmount / purchases.length : 0;
  const effectiveCommissionRate = totalPurchaseAmount > 0 ? (totalCommissionAmount / totalPurchaseAmount) * 100 : 0;
  const trackingCoveragePercent = purchases.length ? (withTrackingIdCount / purchases.length) * 100 : 0;

  const topTrackingIds = Object.entries(trackingStats)
    .map(([id, stats]) => ({ id, ...stats }))
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 5);

  return {
    totalCount: purchases.length,
    totalPurchaseAmount,
    totalCommissionAmount,
    averageOrderValue,
    averageCommissionPerOrder,
    effectiveCommissionRate,
    primaryCurrency,
    statusBreakdown,
    currencyBreakdown,
    purchases24h,
    purchases7d,
    commission24h,
    commission7d,
    withTrackingIdCount,
    trackingCoveragePercent,
    topTrackingIds,
  };
}

function paginatePurchases(purchases: NormalizedPurchase[], page: number, pageSize: number) {
  const startIndex = (page - 1) * pageSize;
  return purchases.slice(startIndex, startIndex + pageSize);
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdminToken(request);
  if (!auth.ok) {
    const authError = auth as { ok: false; status: number; error: string };
    return NextResponse.json({ success: false, error: authError.error }, { status: authError.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = clamp(Number(searchParams.get('page') || DEFAULT_PAGE), 1, 1000);
  const pageSize = clamp(Number(searchParams.get('pageSize') || DEFAULT_PAGE_SIZE), 5, 100);
  const forceRefresh = parseBooleanParam(searchParams.get('forceRefresh'));
  const trackingId = (searchParams.get('trackingId') || '').trim();
  const scanPages = clamp(Number(searchParams.get('scanPages') || DEFAULT_SCAN_PAGES), 1, 10);
  const scanPageSize = clamp(Number(searchParams.get('scanPageSize') || DEFAULT_SCAN_PAGE_SIZE), 10, 100);

  let allPurchases: NormalizedPurchase[] = [];
  let filteredPurchases: NormalizedPurchase[] = [];
  let source: 'live' | 'firestore' = 'firestore';
  let remoteError: string | null = null;

  if (forceRefresh) {
    try {
      const client = getConvertiserClient();
      const collectedRaw: Record<string, any>[] = [];

      for (let currentPage = 1; currentPage <= scanPages; currentPage += 1) {
        const response = await client.listTransactions({ page: currentPage, page_size: scanPageSize });
        const results = Array.isArray(response?.results) ? response.results : [];
        collectedRaw.push(...(results as Record<string, any>[]));

        if (results.length < scanPageSize) {
          break;
        }
      }

      const normalized = collectedRaw
        .filter((row) => hasAliExpressMarker(row))
        .filter((row) => isCompletedPurchase(row))
        .map((row, index) => normalizePurchase(row, index))
        .sort((a, b) => b.purchaseDateMs - a.purchaseDateMs);

      const uniqueById = new Map<string, NormalizedPurchase>();
      for (const item of normalized) {
        uniqueById.set(item.id, item);
      }

      allPurchases = Array.from(uniqueById.values());
      await savePurchasesToFirestore(allPurchases);
      source = 'live';
    } catch (error: any) {
      remoteError = error?.message || 'Nie udało się pobrać danych z Convertiser';
    }
  }

  if (!allPurchases.length) {
    allPurchases = await loadAllPurchasesFromFirestore();

    filteredPurchases = trackingId
      ? allPurchases.filter((purchase) => purchase.clickId === trackingId)
      : allPurchases;

    const pagedPurchases = paginatePurchases(filteredPurchases, page, pageSize);

    const metaDoc = await adminDb.collection('admin_meta').doc('aliexpress-affiliate-purchases').get();
    const meta = metaDoc.data();

    const totalPages = Math.max(1, Math.ceil((filteredPurchases.length || 0) / pageSize));
    const availableTrackingIds = buildTrackingIds(allPurchases);

    return NextResponse.json({
      success: true,
      source,
      remoteError,
      filters: {
        trackingId: trackingId || null,
        availableTrackingIds,
      },
      purchases: pagedPurchases,
      summary: buildSummary(filteredPurchases),
      pagination: {
        page,
        pageSize,
        total: filteredPurchases.length || 0,
        totalPages,
      },
      dataset: {
        loadedRecords: allPurchases.length,
        maxRecords: MAX_FALLBACK_RECORDS,
      },
      sync: {
        lastSyncAt: meta?.lastSyncAt || null,
        forceRefresh,
      },
    });
  }

  filteredPurchases = trackingId
    ? allPurchases.filter((purchase) => purchase.clickId === trackingId)
    : allPurchases;

  const paged = paginatePurchases(filteredPurchases, page, pageSize);
  const total = filteredPurchases.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    success: true,
    source,
    remoteError,
    filters: {
      trackingId: trackingId || null,
      availableTrackingIds: buildTrackingIds(allPurchases),
    },
    purchases: paged,
    summary: buildSummary(filteredPurchases),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
    sync: {
      lastSyncAt: new Date().toISOString(),
      forceRefresh,
    },
  });
}
