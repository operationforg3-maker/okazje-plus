import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { createAliExpressClient } from '@/integrations/aliexpress/client';
import Papa from 'papaparse';

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
  source: 'aliexpress';
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

function normalizePurchase(raw: Record<string, any>, index: number): NormalizedPurchase {
  const transactionId = String(
    raw.id ??
      raw.uuid ??
      raw.transaction_id ??
      raw.transactionId ??
      raw.order_id ??
      raw.orderId ??
      raw.order_no ??
      `unknown-${Date.now()}-${index}`
  );

  const orderId = firstString(raw, ['order_id', 'orderId', 'order_no', 'sale_id', 'external_order_id']);
  const advertiser = 'AliExpress';
  const status =
    firstString(raw, ['order_status', 'status', 'transaction_status', 'state']) ||
    'unknown';

  const purchaseAmount = parseNumber(
    raw.order_amount ??
      raw.sale_amount ??
      raw.transaction_amount ??
      raw.purchase_amount ??
      raw.amount ??
      raw.pay_amount
  );

  const commissionAmount = parseNumber(
    raw.commission ??
      raw.commission_amount ??
      raw.publisher_commission ??
      raw.affiliate_commission ??
      raw.estimated_commission ??
      raw.paid_commission ??
      0
  );

  const currency =
    firstString(raw, ['order_currency', 'currency', 'currency_code', 'sale_currency']) ||
    'USD';

  const purchaseDate = toIsoDate(
    raw.order_time ??
      raw.payment_time ??
      raw.date ??
      raw.transaction_date ??
      raw.created_at ??
      raw.createdAt ??
      raw.event_time
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
    clickId: firstString(raw, ['tracking_id', 'click_id', 'clickId', 'subid', 'sub_id']),
    source: 'aliexpress',
    updatedAt: nowIso,
  };
}

function extractOrderRows(payload: any): Record<string, any>[] {
  const knownPaths = [
    payload?.aliexpress_affiliate_order_list_response?.resp_result?.result?.orders,
    payload?.aliexpress_affiliate_order_list_response?.resp_result?.result?.records,
    payload?.aliexpress_affiliate_order_list_response?.resp_result?.result?.order_list,
    payload?.aliexpress_affiliate_order_list_response?.result?.orders,
    payload?.result?.orders,
    payload?.orders,
    payload?.data?.orders,
    payload?.data?.records,
  ];

  for (const candidate of knownPaths) {
    if (Array.isArray(candidate) && candidate.length >= 0) {
      return candidate as Record<string, any>[];
    }
  }

  const arrays: Record<string, any>[][] = [];
  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      if (value.length === 0 || typeof value[0] === 'object') {
        arrays.push(value as Record<string, any>[]);
      }
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach(visit);
    }
  };

  visit(payload);

  const bestMatch = arrays.find((arr) =>
    arr.some((row) => {
      const keys = Object.keys(row || {}).join('|').toLowerCase();
      return keys.includes('order') || keys.includes('commission') || keys.includes('tracking');
    })
  );

  return bestMatch || [];
}

function getAliExpressApiError(payload: any): string | null {
  const errorNode = payload?.error_response || payload;
  const responseCode = Number(payload?.resp_result?.resp_code || 0);
  const responseMessage = String(payload?.resp_result?.resp_msg || '').trim();

  if (Number.isFinite(responseCode) && responseCode > 0) {
    return responseMessage
      ? `resp_code ${responseCode}: ${responseMessage}`
      : `resp_code ${responseCode}`;
  }

  const code = String(errorNode?.code || '').trim();
  const message = String(
    errorNode?.sub_msg ||
      errorNode?.msg ||
      payload?.message ||
      ''
  ).trim();

  if (!code && !message) {
    return null;
  }

  if (code && message) {
    return `${code}: ${message}`;
  }

  return code || message;
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

async function savePurchasesToFirestore(
  purchases: NormalizedPurchase[],
  sourceLabel: 'aliexpress-api' | 'csv-import' = 'aliexpress-api'
): Promise<void> {
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
      source: sourceLabel,
    },
    { merge: true }
  );
}

function getCsvField(row: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return null;
}

function normalizeCsvPurchase(row: Record<string, any>, index: number): NormalizedPurchase {
  const transactionId =
    getCsvField(row, [
      'transactionId',
      'transaction_id',
      'id',
      'ID transakcji',
      'Transaction ID',
    ]) || `csv-${Date.now()}-${index}`;

  const orderId = getCsvField(row, [
    'orderId',
    'order_id',
    'order_no',
    'ID zamówienia',
    'Order ID',
  ]);

  const status =
    getCsvField(row, ['status', 'order_status', 'transaction_status', 'Status', 'Status transakcji']) ||
    'unknown';

  const advertiser = getCsvField(row, ['advertiser', 'advertiser_name', 'Reklamodawca']) || 'AliExpress';

  const purchaseAmount = parseNumber(
    getCsvField(row, [
      'purchaseAmount',
      'purchase_amount',
      'order_amount',
      'sale_amount',
      'amount',
      'Kwota zakupu',
      'Order amount',
    ])
  );

  const commissionAmount = parseNumber(
    getCsvField(row, [
      'commissionAmount',
      'commission_amount',
      'commission',
      'Prowizja',
      'Commission',
    ])
  );

  const currency =
    getCsvField(row, ['currency', 'currency_code', 'Waluta', 'Currency']) ||
    'USD';

  const purchaseDate = toIsoDate(
    getCsvField(row, [
      'purchaseDate',
      'purchase_date',
      'order_time',
      'payment_time',
      'date',
      'Data',
      'Date',
    ])
  );

  const clickId = getCsvField(row, [
    'clickId',
    'click_id',
    'tracking_id',
    'subid',
    'sub_id',
    'Tracking ID',
  ]);

  const website = getCsvField(row, ['website', 'website_name', 'site', 'Strona']);
  const purchaseDateMs = new Date(purchaseDate).getTime();

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
    website,
    clickId,
    source: 'aliexpress',
    updatedAt: new Date().toISOString(),
  };
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
  const daysBack = clamp(Number(searchParams.get('daysBack') || 90), 1, 365);

  let allPurchases: NormalizedPurchase[] = [];
  let filteredPurchases: NormalizedPurchase[] = [];
  let source: 'live' | 'firestore' = 'firestore';
  let remoteError: string | null = null;

  if (forceRefresh) {
    try {
      const client = createAliExpressClient();
      const collectedRaw: Record<string, any>[] = [];
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

      const formatTopDate = (date: Date) => date.toISOString().replace('T', ' ').substring(0, 19);

      for (let currentPage = 1; currentPage <= scanPages; currentPage += 1) {
        const response = await client.getAffiliateOrders({
          pageNo: currentPage,
          pageSize: scanPageSize,
          startTime: formatTopDate(startDate),
          endTime: formatTopDate(endDate),
        });

        const aliError = getAliExpressApiError(response);
        if (aliError) {
          throw new Error(aliError);
        }

        const results = extractOrderRows(response);
        collectedRaw.push(...results);

        if (results.length < scanPageSize) {
          break;
        }
      }

      const normalized = collectedRaw
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
      remoteError = error?.message || 'Nie udało się pobrać danych z AliExpress API';
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

export async function POST(request: NextRequest) {
  const auth = await verifyAdminToken(request);
  if (!auth.ok) {
    const authError = auth as { ok: false; status: number; error: string };
    return NextResponse.json({ success: false, error: authError.error }, { status: authError.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    const hasTextMethod =
      typeof file === 'object' &&
      file !== null &&
      'text' in file &&
      typeof (file as Blob).text === 'function';

    if (!hasTextMethod) {
      return NextResponse.json(
        { success: false, error: 'Brak pliku CSV do importu' },
        { status: 400 }
      );
    }

    const csvText = await (file as Blob).text();
    if (!csvText.trim()) {
      return NextResponse.json(
        { success: false, error: 'Plik CSV jest pusty' },
        { status: 400 }
      );
    }

    const parsed = Papa.parse<Record<string, any>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parsed.errors?.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Błąd parsowania CSV: ${parsed.errors[0]?.message || 'Nieprawidłowy format'}`,
        },
        { status: 400 }
      );
    }

    const rows = Array.isArray(parsed.data) ? parsed.data : [];
    const normalized = rows
      .map((row, index) => normalizeCsvPurchase(row, index))
      .filter((item) => item.transactionId && item.purchaseDateMs > 0)
      .sort((a, b) => b.purchaseDateMs - a.purchaseDateMs);

    const uniqueById = new Map<string, NormalizedPurchase>();
    for (const item of normalized) {
      uniqueById.set(item.id, item);
    }

    const importedPurchases = Array.from(uniqueById.values());
    if (!importedPurchases.length) {
      return NextResponse.json(
        { success: false, error: 'Nie znaleziono poprawnych rekordów w CSV' },
        { status: 400 }
      );
    }

    await savePurchasesToFirestore(importedPurchases, 'csv-import');

    return NextResponse.json({
      success: true,
      imported: importedPurchases.length,
      source: 'csv-import',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Nie udało się zaimportować CSV' },
      { status: 500 }
    );
  }
}
