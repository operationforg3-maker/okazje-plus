import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

interface RefreshAffiliateRequest {
  productId?: string;
  dealIds?: string[];
  limit?: number;
  dryRun?: boolean;
}

const shouldRefresh = (deal: any): boolean => {
  const link = (deal?.affiliateLink || deal?.link || deal?.sourceUrl || '').trim();
  if (!link) return true;
  if (deal?.sourceUrl && link === deal.sourceUrl) return true;
  return false;
};

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = (await request.json().catch(() => ({}))) as RefreshAffiliateRequest;
    const dryRun = body.dryRun !== undefined ? Boolean(body.dryRun) : true;
    const limit = Math.min(200, Math.max(1, Number(body.limit ?? 50)));

    let dealsSnap: FirebaseFirestore.QuerySnapshot;
    if (body.dealIds && body.dealIds.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < body.dealIds.length; i += 30) {
        chunks.push(body.dealIds.slice(i, i + 30));
      }
      const results: FirebaseFirestore.QuerySnapshot[] = [];
      for (const chunk of chunks) {
        const snap = await adminDb
          .collection('deals')
          .where(adminDb.FieldPath.documentId(), 'in', chunk)
          .get();
        results.push(snap);
      }
      const docs = results.flatMap((s) => s.docs);
      dealsSnap = { docs } as FirebaseFirestore.QuerySnapshot;
    } else if (body.productId) {
      dealsSnap = await adminDb
        .collection('deals')
        .where('productCoreId', '==', body.productId)
        .limit(limit)
        .get();
    } else {
      dealsSnap = await adminDb
        .collection('deals')
        .where('source', '==', 'convertiser')
        .limit(limit)
        .get();
    }

    const toUpdate = dealsSnap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter((item) => shouldRefresh(item.data));

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        matched: toUpdate.length,
        sample: toUpdate.slice(0, 10).map((item) => ({
          id: item.id,
          sourceProductId: item.data?.sourceProductId,
          link: item.data?.link,
          sourceUrl: item.data?.sourceUrl,
        })),
      });
    }

    const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
    const client = getConvertiserClient();
    const websiteUuid = process.env.CONVERTISER_WEBSITE_UUID || process.env.CONVERTISER_WEBSITE_ID;
    const trackingParams = websiteUuid ? { website_uuid: websiteUuid } : undefined;

    let updated = 0;
    const errors: Array<{ id: string; message: string }> = [];

    for (const item of toUpdate) {
      try {
        const deal = item.data;
        const sourceProductId = deal?.sourceProductId;
        if (!sourceProductId) continue;

        const isOfferPromotion = deal?.metadata?.promotionType === 'offer' || deal?.dealType === 'coupon';
        const tracking = isOfferPromotion
          ? await client.generateOfferTrackingLink(sourceProductId, trackingParams)
          : await client.generateProductTrackingLink(sourceProductId, trackingParams);
        let resolved = (tracking as any)?.tracking_link
          || (tracking as any)?.url
          || (tracking as any)?.link;

        if (!resolved) {
          const detail = await client.getOfferDetail(sourceProductId);
          resolved = (detail as any)?.tracking_link
            || (detail as any)?.tracking_url
            || (detail as any)?.affiliate_url
            || (detail as any)?.aff_link
            || (detail as any)?.preview_url
            || (detail as any)?.offer_display_url
            || (detail as any)?.url;
        }

        if (!resolved) continue;

        await adminDb.collection('deals').doc(item.id).update({
          affiliateLink: resolved,
          link: resolved,
          sourceUrl: resolved,
          updatedAt: new Date().toISOString(),
        });
        updated++;
      } catch (err: any) {
        errors.push({ id: item.id, message: err?.message || 'unknown' });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      matched: toUpdate.length,
      updated,
      errors,
    });
  } catch (error: any) {
    console.error('[Refresh Affiliate API Error]', error);
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Brak uprawnień admina.' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Nie udało się odświeżyć linków afiliacyjnych', details: error?.message },
      { status: 500 }
    );
  }
}
