import type { PromotionCampaignInfo } from '@/lib/types';

type ParsedAliExpressPromotionData = {
  couponCode?: string;
  couponAmount?: number;
  couponMinOrder?: number;
  totalCoupons?: number;
  hasCoupons: boolean;
  promotionId?: string;
  flashDeal: boolean;
  appSalePrice?: number;
  appSalePriceCurrency?: string;
  dealType: 'coupon' | 'flash_deal' | 'sale' | 'regular';
  promotionCampaign?: PromotionCampaignInfo;
};

const asTrimmedString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const match = String(value).match(/-?[\d.,]+/);
  if (!match) return undefined;
  const parsed = Number(match[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return undefined;
};

const firstString = (values: unknown[]): string | undefined => {
  for (const value of values) {
    const parsed = asTrimmedString(value);
    if (parsed) return parsed;
  }
  return undefined;
};

const firstNumber = (values: unknown[]): number | undefined => {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
};

const firstBoolean = (values: unknown[]): boolean | undefined => {
  for (const value of values) {
    const parsed = asBoolean(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
};

const toIsoDate = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;

  if (typeof value === 'number') {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  const raw = String(value).trim();
  if (!raw) return undefined;

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

export function parseAliExpressPromotionData(
  raw: any,
  options?: {
    currency?: string;
    fallbackUrl?: string;
  },
): ParsedAliExpressPromotionData {
  const currency = asTrimmedString(options?.currency) || 'PLN';
  const promoCodeInfo = raw?.promo_code_info && typeof raw.promo_code_info === 'object'
    ? raw.promo_code_info
    : raw?.promoCodeInfo && typeof raw.promoCodeInfo === 'object'
      ? raw.promoCodeInfo
      : {};

  const couponList = Array.isArray(raw?.coupon_list)
    ? raw.coupon_list
    : Array.isArray(raw?.couponList)
      ? raw.couponList
      : [];

  const bestCoupon = couponList.length > 0
    ? couponList.reduce((best: any, candidate: any) => {
        const currentValue = firstNumber([
          candidate?.coupon_discount,
          candidate?.discount_amount,
          candidate?.amount,
        ]) || 0;
        const bestValue = firstNumber([
          best?.coupon_discount,
          best?.discount_amount,
          best?.amount,
        ]) || 0;
        return currentValue > bestValue ? candidate : best;
      }, couponList[0])
    : undefined;

  const couponCode = firstString([
    raw?.coupon_code,
    raw?.promo_code,
    raw?.promotion_code,
    raw?.voucher_code,
    promoCodeInfo?.promo_code,
    bestCoupon?.coupon_code,
    bestCoupon?.code,
  ]);
  const couponAmount = firstNumber([
    raw?.coupon_amount,
    raw?.coupon_discount,
    raw?.coupon_value,
    promoCodeInfo?.code_value,
    bestCoupon?.coupon_discount,
    bestCoupon?.discount_amount,
    bestCoupon?.amount,
  ]);
  const couponMinOrder = firstNumber([
    raw?.coupon_min_spend,
    raw?.min_spend,
    raw?.min_order_amount,
    raw?.min_order_value,
    promoCodeInfo?.code_mini_spend,
    bestCoupon?.coupon_min_amount,
    bestCoupon?.min_order_amount,
    bestCoupon?.min_spend,
  ]);
  const totalCoupons = couponList.length > 0
    ? couponList.length
    : firstNumber([
        promoCodeInfo?.code_quantity,
        raw?.coupon_quantity,
      ]);
  const hasCoupons = Boolean(couponCode || couponAmount || raw?.hasCoupons || raw?.has_coupons || promoCodeInfo?.promo_code);

  const promotionId = firstString([
    raw?.promotion_id,
    raw?.promotionId,
    raw?.campaign_id,
    raw?.campaignId,
    raw?.activity_id,
  ]);
  const campaignName = firstString([
    raw?.campaign_name,
    raw?.promotion_name,
    raw?.promotion_title,
    raw?.activity_name,
    raw?.event_name,
  ]);
  const promotionTypeRaw = firstString([
    raw?.promotion_type,
    raw?.campaign_type,
    raw?.activity_type,
    raw?.promo_type,
    raw?.scene,
  ]);
  const flashDeal = firstBoolean([
    raw?.flash_deal,
    raw?.flashDeal,
    raw?.is_flash_sale,
    raw?.is_flash_deal,
  ]) || Boolean(promotionTypeRaw && promotionTypeRaw.toLowerCase().includes('flash'));

  const currentPrice = firstNumber([
    raw?.target_sale_price,
    raw?.sale_price,
  ]);
  const originalPrice = firstNumber([
    raw?.target_original_price,
    raw?.original_price,
  ]);
  const appSalePrice = firstNumber([
    raw?.target_app_sale_price,
    raw?.app_sale_price,
    raw?.appSalePrice,
  ]);

  const startAt = toIsoDate(firstString([
    raw?.promotion_start_time,
    raw?.campaign_start_time,
    raw?.activity_start_time,
    raw?.sale_start_time,
    promoCodeInfo?.code_availabletime_start,
    raw?.start_time,
  ]));
  const endAt = toIsoDate(firstString([
    raw?.promotion_end_time,
    raw?.campaign_end_time,
    raw?.activity_end_time,
    raw?.sale_end_time,
    promoCodeInfo?.code_availabletime_end,
    raw?.end_time,
  ]));

  const now = Date.now();
  const startTime = startAt ? Date.parse(startAt) : undefined;
  const endTime = endAt ? Date.parse(endAt) : undefined;
  const active = typeof startTime === 'number' && !Number.isNaN(startTime) && typeof endTime === 'number' && !Number.isNaN(endTime)
    ? startTime <= now && now <= endTime
    : Boolean(flashDeal || hasCoupons || promotionId || campaignName || appSalePrice);

  const appOnly = Boolean(appSalePrice && currentPrice && appSalePrice < currentPrice);
  const inferredType: PromotionCampaignInfo['type'] = flashDeal
    ? 'flash_sale'
    : hasCoupons
      ? 'coupon'
      : appOnly
        ? 'app_exclusive'
        : (promotionId || campaignName || (originalPrice && currentPrice && originalPrice > currentPrice))
          ? 'sale'
          : undefined;

  const label = campaignName
    || (flashDeal ? 'Flash Sale' : undefined)
    || (appOnly ? 'Cena w aplikacji' : undefined)
    || (hasCoupons ? 'Akcja kuponowa' : undefined)
    || (promotionId ? 'Kampania sprzedażowa' : undefined);

  const promotionCampaign = label || promotionId || startAt || endAt || appSalePrice
    ? {
        id: promotionId,
        name: campaignName,
        type: inferredType,
        label,
        active,
        appOnly,
        flashDeal,
        startAt,
        endAt,
        promoUrl: firstString([
          promoCodeInfo?.code_promotionurl,
          raw?.promotion_link,
          raw?.product_detail_url,
          options?.fallbackUrl,
        ]),
        price: {
          current: currentPrice,
          original: originalPrice,
          appSale: appSalePrice,
          currency,
        },
        coupon: hasCoupons
          ? {
              code: couponCode,
              discountAmount: couponAmount,
              minOrderAmount: couponMinOrder,
              totalCoupons,
              availableFrom: toIsoDate(promoCodeInfo?.code_availabletime_start),
              availableTo: toIsoDate(promoCodeInfo?.code_availabletime_end),
              promotionUrl: firstString([
                promoCodeInfo?.code_promotionurl,
                raw?.promotion_link,
                options?.fallbackUrl,
              ]),
            }
          : undefined,
      }
    : undefined;

  const dealType: ParsedAliExpressPromotionData['dealType'] = flashDeal
    ? 'flash_deal'
    : hasCoupons
      ? 'coupon'
      : (originalPrice && currentPrice && originalPrice > currentPrice) || Boolean(promotionId || campaignName || appOnly)
        ? 'sale'
        : 'regular';

  return {
    couponCode,
    couponAmount,
    couponMinOrder,
    totalCoupons,
    hasCoupons,
    promotionId,
    flashDeal,
    appSalePrice,
    appSalePriceCurrency: firstString([
      raw?.target_app_sale_price_currency,
      raw?.app_sale_price_currency,
      currency,
    ]),
    dealType,
    promotionCampaign,
  };
}