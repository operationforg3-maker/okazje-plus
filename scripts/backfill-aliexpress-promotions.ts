import { adminDb } from '@/lib/firebase-admin';
import { parseAliExpressPromotionData } from '@/lib/aliexpress-promotion-utils';
import { FieldPath } from 'firebase-admin/firestore';

type FireDoc = Record<string, any>;

type FixResult = {
  updates: Record<string, any>;
  reasons: string[];
};

const APPLY = process.argv.includes('--apply');
const ONLY_ARG = (process.argv.find((arg) => arg.startsWith('--only=')) || '--only=both').split('=')[1] || 'both';
const ONLY = ONLY_ARG === 'products' || ONLY_ARG === 'deals' ? ONLY_ARG : 'both';
const LIMIT = Number.parseInt((process.argv.find((arg) => arg.startsWith('--limit=')) || '').split('=')[1] || '0', 10);
const PAGE_SIZE = Number.parseInt((process.argv.find((arg) => arg.startsWith('--page-size=')) || '').split('=')[1] || '300', 10);
const BATCH_LIMIT = Number.parseInt((process.argv.find((arg) => arg.startsWith('--batch-size=')) || '').split('=')[1] || '350', 10);
const START_AFTER_DEAL = ((process.argv.find((arg) => arg.startsWith('--start-after-deal=')) || '').split('=')[1] || '').trim();
const START_AFTER_PRODUCT = ((process.argv.find((arg) => arg.startsWith('--start-after-product=')) || '').split('=')[1] || '').trim();

function sourceIsAliExpress(data: FireDoc): boolean {
  const directSource = String(data.source || '').toLowerCase();
  const metadataSource = String(data?.metadata?.source || '').toLowerCase();
  return directSource === 'aliexpress' || metadataSource === 'aliexpress';
}

function getByPath(obj: FireDoc, path: string): unknown {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function isDifferent(current: unknown, next: unknown): boolean {
  if (current === next) return false;
  if (
    current &&
    next &&
    typeof current === 'object' &&
    typeof next === 'object'
  ) {
    return JSON.stringify(current) !== JSON.stringify(next);
  }
  return true;
}

function pushUpdate(
  updates: Record<string, any>,
  reasons: string[],
  data: FireDoc,
  path: string,
  value: unknown,
  reason: string
) {
  if (value === undefined) return;
  const current = getByPath(data, path);
  if (!isDifferent(current, value)) return;
  updates[path] = value;
  reasons.push(reason);
}

function dedupeReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons));
}

function buildPromoSeed(data: FireDoc): FireDoc {
  const metadata = (data.metadata || {}) as FireDoc;
  const coupon = (metadata.coupon || {}) as FireDoc;
  const flashSale = (metadata.flashSale || {}) as FireDoc;

  return {
    ...data,
    ...metadata,
    coupon_code: data.couponCode || coupon.code,
    coupon_amount: coupon.discountAmount,
    coupon_min_spend: coupon.minOrderAmount,
    coupon_quantity: coupon.totalCoupons,
    has_coupons: Boolean(metadata.hasCoupons || coupon.code || coupon.discountAmount),
    promotion_id: metadata.promotionId || data.promotionId,
    flash_deal: metadata.flashDeal ?? data.flashDeal,
    target_app_sale_price: metadata.appSalePrice ?? flashSale.appSalePrice,
    target_original_price: data.originalPrice?.amount || data.originalPrice || flashSale.originalPrice,
    target_sale_price: data.price?.amount || data.price,
    promotion_link: data.affiliateLink || data.affiliateUrl || data.link,
    product_detail_url: data.affiliateLink || data.affiliateUrl || data.link,
    promo_code_info:
      metadata.promo_code_info ||
      metadata.promoCodeInfo ||
      (coupon.code || coupon.discountAmount
        ? {
            promo_code: coupon.code,
            code_value: coupon.discountAmount,
            code_mini_spend: coupon.minOrderAmount,
            code_quantity: coupon.totalCoupons,
            code_promotionurl: data.affiliateLink || data.affiliateUrl || data.link,
          }
        : undefined),
    coupon_list:
      metadata.coupon_list ||
      metadata.couponList ||
      (coupon.code || coupon.discountAmount
        ? [
            {
              coupon_code: coupon.code,
              coupon_discount: coupon.discountAmount,
              coupon_min_amount: coupon.minOrderAmount,
            },
          ]
        : undefined),
  };
}

function buildDealFix(data: FireDoc): FixResult {
  const updates: Record<string, any> = {};
  const reasons: string[] = [];
  const metadata = (data.metadata || {}) as FireDoc;
  const currency =
    data.price?.currency ||
    metadata.currency ||
    metadata.target_sale_price_currency ||
    'PLN';

  const promotionData = parseAliExpressPromotionData(buildPromoSeed(data), {
    currency: String(currency).toUpperCase(),
    fallbackUrl: String(data.affiliateLink || data.affiliateUrl || data.link || '').trim(),
  });

  const existingCampaign = metadata.promotionCampaign && typeof metadata.promotionCampaign === 'object'
    ? metadata.promotionCampaign
    : undefined;
  const existingCoupon = metadata.coupon && typeof metadata.coupon === 'object'
    ? metadata.coupon
    : undefined;
  const nextCampaign = promotionData.promotionCampaign || existingCampaign;
  const nextCoupon = promotionData.hasCoupons
    ? {
        code: promotionData.couponCode,
        discountAmount: promotionData.couponAmount,
        minOrderAmount: promotionData.couponMinOrder,
        totalCoupons: promotionData.totalCoupons,
      }
    : existingCoupon;

  const hasAnyPromoSignal = Boolean(
    nextCampaign ||
    nextCoupon ||
    promotionData.promotionId ||
    promotionData.appSalePrice ||
    promotionData.flashDeal ||
    data.couponCode ||
    metadata.promotionId
  );

  if (!hasAnyPromoSignal) {
    return { updates, reasons };
  }

  pushUpdate(updates, reasons, data, 'dealType', promotionData.dealType, 'dealType');
  pushUpdate(updates, reasons, data, 'couponCode', promotionData.couponCode || existingCoupon?.code || null, 'couponCode');
  pushUpdate(updates, reasons, data, 'metadata.promotionId', promotionData.promotionId || metadata.promotionId || null, 'promotionId');
  pushUpdate(updates, reasons, data, 'metadata.flashDeal', Boolean(promotionData.flashDeal || nextCampaign?.flashDeal), 'flashDeal');
  pushUpdate(updates, reasons, data, 'metadata.appSalePrice', promotionData.appSalePrice ?? metadata.appSalePrice ?? null, 'appSalePrice');
  pushUpdate(updates, reasons, data, 'metadata.promotionCampaign', nextCampaign || null, 'promotionCampaign');
  pushUpdate(updates, reasons, data, 'metadata.coupon', nextCoupon || null, 'coupon');

  if (promotionData.appSalePrice) {
    const currentAmount = Number(data.price?.amount || data.price || promotionData.appSalePrice);
    pushUpdate(
      updates,
      reasons,
      data,
      'metadata.flashSale',
      {
        active: true,
        appSalePrice: promotionData.appSalePrice,
        originalPrice: Number.isFinite(currentAmount) ? currentAmount : promotionData.appSalePrice,
      },
      'flashSale'
    );
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString();
    updates['metadata.promotionBackfilledAt'] = new Date().toISOString();
  }

  return { updates, reasons: dedupeReasons(reasons) };
}

function buildProductFix(data: FireDoc): FixResult {
  const updates: Record<string, any> = {};
  const reasons: string[] = [];
  const metadata = (data.metadata || {}) as FireDoc;

  const promotionData = parseAliExpressPromotionData(buildPromoSeed(data), {
    currency: String(data.currency || metadata.currency || 'PLN').toUpperCase(),
    fallbackUrl: String(data.affiliateUrl || data.sourceUrl || '').trim(),
  });

  const existingCampaign = metadata.promotionCampaign && typeof metadata.promotionCampaign === 'object'
    ? metadata.promotionCampaign
    : undefined;
  const existingCoupon = metadata.coupon && typeof metadata.coupon === 'object'
    ? metadata.coupon
    : undefined;
  const nextCampaign = promotionData.promotionCampaign || existingCampaign;
  const nextCoupon = promotionData.hasCoupons
    ? {
        code: promotionData.couponCode,
        discountAmount: promotionData.couponAmount,
        minOrderAmount: promotionData.couponMinOrder,
        totalCoupons: promotionData.totalCoupons,
      }
    : existingCoupon;

  const hasAnyPromoSignal = Boolean(
    nextCampaign ||
    nextCoupon ||
    promotionData.promotionId ||
    promotionData.appSalePrice ||
    promotionData.flashDeal ||
    data.bestDealCouponCode ||
    metadata.promotionId
  );

  if (!hasAnyPromoSignal) {
    return { updates, reasons };
  }

  const nextBestDealType = promotionData.dealType;
  const nextBestDealCouponCode = promotionData.couponCode || existingCoupon?.code || data.bestDealCouponCode || null;

  pushUpdate(updates, reasons, data, 'bestDealType', nextBestDealType, 'bestDealType');
  pushUpdate(updates, reasons, data, 'bestDealCouponCode', nextBestDealCouponCode, 'bestDealCouponCode');
  pushUpdate(updates, reasons, data, 'metadata.promotionId', promotionData.promotionId || metadata.promotionId || null, 'promotionId');
  pushUpdate(updates, reasons, data, 'metadata.flashDeal', Boolean(promotionData.flashDeal || nextCampaign?.flashDeal), 'flashDeal');
  pushUpdate(updates, reasons, data, 'metadata.appSalePrice', promotionData.appSalePrice ?? metadata.appSalePrice ?? null, 'appSalePrice');
  pushUpdate(updates, reasons, data, 'metadata.promotionCampaign', nextCampaign || null, 'promotionCampaign');
  pushUpdate(updates, reasons, data, 'metadata.coupon', nextCoupon || null, 'coupon');

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date().toISOString();
    updates['metadata.promotionBackfilledAt'] = new Date().toISOString();
  }

  return { updates, reasons: dedupeReasons(reasons) };
}

async function processCollection(options: {
  collectionName: 'deals' | 'product_cores';
  startAfterId?: string;
  limit: number;
  pageSize: number;
  batchLimit: number;
  apply: boolean;
}) {
  const {
    collectionName,
    startAfterId,
    limit,
    pageSize,
    batchLimit,
    apply,
  } = options;

  let scanned = 0;
  let eligible = 0;
  let fixes = 0;
  let cursor = startAfterId || '';
  let lastScannedId = startAfterId || '';
  let batch = adminDb.batch();
  let batchOps = 0;
  const reasonStats: Record<string, number> = {};
  const samples: Array<{ id: string; reasons: string[]; updates: Record<string, any> }> = [];

  const flush = async () => {
    if (!apply || batchOps === 0) return;
    await batch.commit();
    batch = adminDb.batch();
    batchOps = 0;
  };

  while (true) {
    let query: any = adminDb
      .collection(collectionName)
      .orderBy(FieldPath.documentId())
      .limit(pageSize);

    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = { id: doc.id, ...(doc.data() as FireDoc) };
      lastScannedId = doc.id;
      scanned += 1;

      if (!sourceIsAliExpress(data)) {
        if (limit > 0 && scanned >= limit) break;
        continue;
      }

      eligible += 1;
      const fix = collectionName === 'deals' ? buildDealFix(data) : buildProductFix(data);

      if (Object.keys(fix.updates).length > 0) {
        fixes += 1;
        for (const reason of fix.reasons) {
          reasonStats[reason] = (reasonStats[reason] || 0) + 1;
        }

        if (samples.length < 5) {
          samples.push({
            id: doc.id,
            reasons: fix.reasons,
            updates: fix.updates,
          });
        }

        if (apply) {
          batch.update(doc.ref, fix.updates);
          batchOps += 1;
          if (batchOps >= batchLimit) {
            await flush();
          }
        }
      }

      if (limit > 0 && scanned >= limit) break;
    }

    await flush();

    if (limit > 0 && scanned >= limit) {
      break;
    }

    if (snap.size < pageSize) {
      break;
    }

    cursor = snap.docs[snap.docs.length - 1]?.id || '';
  }

  await flush();

  return {
    collectionName,
    mode: apply ? 'APPLY' : 'DRY_RUN',
    scanned,
    eligible,
    fixes,
    reasonStats,
    samples,
    checkpoint: {
      startAfterId: startAfterId || null,
      lastScannedId: lastScannedId || null,
    },
  };
}

async function main() {
  console.log(
    `[backfill-aliexpress-promotions] mode=${APPLY ? 'APPLY' : 'DRY_RUN'} only=${ONLY} limit=${LIMIT || 'none'} pageSize=${PAGE_SIZE} batchSize=${BATCH_LIMIT}`
  );

  const outputs: any[] = [];

  if (ONLY === 'both' || ONLY === 'deals') {
    outputs.push(
      await processCollection({
        collectionName: 'deals',
        startAfterId: START_AFTER_DEAL,
        limit: LIMIT,
        pageSize: PAGE_SIZE,
        batchLimit: BATCH_LIMIT,
        apply: APPLY,
      })
    );
  }

  if (ONLY === 'both' || ONLY === 'products') {
    outputs.push(
      await processCollection({
        collectionName: 'product_cores',
        startAfterId: START_AFTER_PRODUCT,
        limit: LIMIT,
        pageSize: PAGE_SIZE,
        batchLimit: BATCH_LIMIT,
        apply: APPLY,
      })
    );
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    only: ONLY,
    outputs,
  }, null, 2));
}

main().catch((error) => {
  console.error('[backfill-aliexpress-promotions] failed', error instanceof Error ? error.message : String(error));
  process.exit(1);
});