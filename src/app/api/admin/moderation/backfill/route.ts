import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { startRefinerJob } from '@/lib/automation/refiner';
import { DealRefiner } from '@/lib/automation/deal-refiner';
import { getExternalUrl } from '@/lib/external-url';

const REQUIRED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

type Locale = (typeof REQUIRED_LOCALES)[number];

type BackfillRequest = {
  dryRun?: boolean;
  maxScanPerCollection?: number;
  maxProcessPerType?: number;
  approvedOnly?: boolean;
};

function getLocalizedValue(value: any, locale: Locale): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';
  return String((value as any)[locale] || '').trim();
}

function hasMissingLocalizedField(value: any): boolean {
  if (!value) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value !== 'object') return true;
  return REQUIRED_LOCALES.some((locale) => !getLocalizedValue(value, locale));
}

function dealNeedsBackfill(raw: any): boolean {
  if (!raw) return true;

  const externalUrl = getExternalUrl(
    raw.link,
    raw.affiliateLink,
    raw.affiliateUrl,
    raw.dealUrl,
    raw.sourceUrl,
    raw.url,
    raw.externalUrl,
    raw?.metadata?.offerPreviewUrl,
    raw?.metadata?.previewUrl,
    raw?.metadata?.offerUrl,
    raw?.metadata?.externalUrl,
    raw?.metadata?.url,
    raw?.product?.link,
    raw?.product?.affiliateLink,
    raw?.product?.sourceUrl
  );
  if (!externalUrl) return true;

  if (hasMissingLocalizedField(raw.title)) return true;
  if (hasMissingLocalizedField(raw.description)) return true;
  if (hasMissingLocalizedField(raw?.metadata?.offerSummary)) return true;

  const sellingPoints = raw?.metadata?.sellingPoints;
  if (!sellingPoints) return true;

  if (Array.isArray(sellingPoints)) {
    const hasAnyPoint = sellingPoints.some((entry: any) => {
      if (typeof entry === 'string') return entry.trim().length > 0;
      if (entry && typeof entry === 'object') {
        return REQUIRED_LOCALES.some((locale) => getLocalizedValue(entry, locale).length > 0);
      }
      return false;
    });
    if (!hasAnyPoint) return true;
  } else if (typeof sellingPoints === 'object') {
    if (REQUIRED_LOCALES.some((locale) => !getLocalizedValue(sellingPoints, locale))) return true;
  } else {
    return true;
  }

  return false;
}

function productNeedsBackfill(raw: any): boolean {
  if (!raw) return true;

  if (hasMissingLocalizedField(raw.title)) return true;

  const hasDescription = !hasMissingLocalizedField(raw.description) || !hasMissingLocalizedField(raw.fullDescription);
  if (!hasDescription) return true;

  if (hasMissingLocalizedField(raw.shortDescription)) return true;

  const metaTitle = typeof raw.metaTitle === 'string' ? raw.metaTitle.trim() : '';
  const metaDescription = typeof raw.metaDescription === 'string' ? raw.metaDescription.trim() : '';
  if (!metaTitle || !metaDescription) return true;

  const specs = raw.specs;
  const specsCount = specs && typeof specs === 'object' ? Object.keys(specs).length : 0;
  const structuredSpecs = Array.isArray(raw.specificationsStructured) ? raw.specificationsStructured : [];
  if (specsCount === 0 && structuredSpecs.length === 0) return true;

  return false;
}

async function collectMissingIds(
  collectionName: 'deals' | 'product_cores',
  predicate: (raw: any) => boolean,
  maxScan: number,
  approvedOnly: boolean
): Promise<{ ids: string[]; scanned: number }> {
  const ids: string[] = [];
  const pageSize = 250;
  let scanned = 0;
  let lastDocId: string | null = null;

  while (scanned < maxScan) {
    let query = adminDb
      .collection(collectionName)
      .limit(Math.min(pageSize, maxScan - scanned));

    if (approvedOnly) {
      query = query.where('status', '==', 'approved');
    }

    query = query.orderBy(FieldPath.documentId());

    if (lastDocId) {
      query = query.startAfter(lastDocId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      scanned += 1;
      if (predicate(doc.data())) {
        ids.push(doc.id);
      }
    }

    lastDocId = snapshot.docs[snapshot.docs.length - 1]?.id || null;

    if (snapshot.size < pageSize) break;
  }

  return { ids, scanned };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as BackfillRequest;

    const dryRun = body.dryRun === true;
    const approvedOnly = body.approvedOnly !== false;
    const maxScanPerCollection = Math.min(Math.max(Number(body.maxScanPerCollection || 10000), 100), 20000);
    const maxProcessPerType = Math.min(Math.max(Number(body.maxProcessPerType || 400), 10), 1000);

    const [dealDiscovery, productDiscovery] = await Promise.all([
      collectMissingIds('deals', dealNeedsBackfill, maxScanPerCollection, approvedOnly),
      collectMissingIds('product_cores', productNeedsBackfill, maxScanPerCollection, approvedOnly),
    ]);

    const dealIdsToProcess = dealDiscovery.ids.slice(0, maxProcessPerType);
    const productIdsToProcess = productDiscovery.ids.slice(0, maxProcessPerType);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        scanned: {
          deals: dealDiscovery.scanned,
          products: productDiscovery.scanned,
        },
        missing: {
          deals: dealDiscovery.ids.length,
          products: productDiscovery.ids.length,
        },
        planned: {
          deals: dealIdsToProcess.length,
          products: productIdsToProcess.length,
        },
        approvedOnly,
      });
    }

    let dealJob: any = null;
    let productJob: any = null;

    if (dealIdsToProcess.length > 0) {
      const dealRefiner = new DealRefiner(`deal-backfill-${Date.now()}`);
      dealJob = await dealRefiner.refineDeals(dealIdsToProcess);
    }

    if (productIdsToProcess.length > 0) {
      productJob = await startRefinerJob(productIdsToProcess, 'full_enrichment');
    }

    return NextResponse.json({
      success: true,
      message: 'Backfill uruchomiony pomyślnie',
      triggeredBy: session.email || session.uid,
      approvedOnly,
      scanned: {
        deals: dealDiscovery.scanned,
        products: productDiscovery.scanned,
      },
      missing: {
        deals: dealDiscovery.ids.length,
        products: productDiscovery.ids.length,
      },
      processed: {
        deals: dealIdsToProcess.length,
        products: productIdsToProcess.length,
      },
      hasMore: {
        deals: dealDiscovery.ids.length > dealIdsToProcess.length,
        products: productDiscovery.ids.length > productIdsToProcess.length,
      },
      jobs: {
        deals: dealJob,
        products: productJob,
      },
    });
  } catch (error: any) {
    console.error('[admin/moderation/backfill] Error:', error);

    if (String(error?.message || '').includes('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }
    if (String(error?.message || '').includes('Forbidden')) {
      return NextResponse.json({ success: false, error: 'Brak uprawnień admina' }, { status: 403 });
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Nie udało się uruchomić backfillu',
      },
      { status: 500 }
    );
  }
}
