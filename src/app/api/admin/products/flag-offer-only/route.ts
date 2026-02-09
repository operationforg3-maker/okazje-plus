import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface FlagOfferOnlyRequest {
  dryRun?: boolean;
  limit?: number;
  statuses?: Array<'draft' | 'pending_approval' | 'approved' | 'rejected'>;
}

const DOMAIN_REGEX = /\b[a-z0-9-]+\.(pl|com|net|org|eu|store|shop|co|io|de|fr|it|es|cz|sk|uk)\b/i;
const KEYWORD_REGEX = /\b(kupon|zniżk|rabat|voucher|promocj|kod|cashback|gratis|oferta|coupon|discount|promo|code)\b/i;

const isOfferOnlyProduct = (product: any): { match: boolean; reason?: string } => {
  const titleParts = [
    product?.title?.pl,
    product?.title?.en,
    product?.title?.de,
    product?.metadata?.originalTitle,
  ].filter(Boolean);
  const title = titleParts.join(' ').trim();
  const titleLower = title.toLowerCase();

  const hasDomain = DOMAIN_REGEX.test(title);
  const hasKeyword = KEYWORD_REGEX.test(titleLower);
  const hasDigits = /\d/.test(title);
  const specsEmpty = !product?.specs || Object.keys(product.specs).length === 0;
  const categoriesUnc = product?.mainCategorySlug === 'uncategorized' || product?.subCategorySlug === 'uncategorized';
  const sourceConvertiser = product?.metadata?.source === 'convertiser';
  const offerOnlyFlag = product?.metadata?.offerOnly === true;

  if (offerOnlyFlag) {
    return { match: true, reason: 'flag_offerOnly' };
  }

  if (!sourceConvertiser) {
    return { match: false };
  }

  if (hasDomain && (!hasDigits || specsEmpty || categoriesUnc)) {
    return { match: true, reason: 'domain_offer_like' };
  }

  if (hasKeyword && (hasDomain || specsEmpty || categoriesUnc)) {
    return { match: true, reason: 'keyword_offer_like' };
  }

  return { match: false };
};

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = (await request.json().catch(() => ({}))) as FlagOfferOnlyRequest;
    const dryRun = body.dryRun !== undefined ? Boolean(body.dryRun) : true;
    const limit = Math.min(500, Math.max(1, Number(body.limit ?? 200)));
    const statuses = (body.statuses && body.statuses.length > 0
      ? body.statuses
      : ['draft', 'pending_approval']) as Array<'draft' | 'pending_approval' | 'approved' | 'rejected'>;

    const matches: Array<{ id: string; title: string; status: string; reason: string }> = [];

    for (const status of statuses) {
      if (matches.length >= limit) break;

      const snapshot = await adminDb
        .collection('product_cores')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(limit - matches.length)
        .get();

      snapshot.forEach((doc) => {
        if (matches.length >= limit) return;
        const data = doc.data();
        const { match, reason } = isOfferOnlyProduct(data);
        if (match) {
          const title = (data?.title?.pl || data?.title?.en || data?.title?.de || data?.metadata?.originalTitle || doc.id) as string;
          matches.push({
            id: doc.id,
            title,
            status: data?.status || status,
            reason: reason || 'unknown',
          });
        }
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        matched: matches.length,
        items: matches.slice(0, 50),
      });
    }

    let updated = 0;
    let batch = adminDb.batch();
    let batchCount = 0;
    const now = new Date().toISOString();

    for (const item of matches) {
      const ref = adminDb.collection('product_cores').doc(item.id);
      batch.update(ref, {
        status: 'rejected',
        updatedAt: now,
        'metadata.offerOnly': true,
        'metadata.offerOnlyReason': item.reason,
        'metadata.offerOnlyFlaggedAt': now,
        'metadata.offerOnlyFlaggedBy': 'system',
        'metadata.offerOnlyFlaggedSource': 'bulk-admin',
      });
      batchCount++;
      updated++;

      if (batchCount >= 450) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      matched: matches.length,
      updated,
    });
  } catch (error: any) {
    console.error('[Flag Offer-Only Products API Error]', error);
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Brak uprawnień admina.' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Nie udało się oznaczyć offer-only produktów', details: error?.message },
      { status: 500 }
    );
  }
}
