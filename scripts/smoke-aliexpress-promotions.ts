import * as dotenv from 'dotenv';
import path from 'path';
import { getAliExpressClient } from '@/lib/integrations/aliexpress-client';
import { parseAliExpressPromotionData } from '@/lib/aliexpress-promotion-utils';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type SmokeResult = {
  keyword: string;
  productsFound: number;
  detailsFetched: number;
  promoSignals: number;
  samples: Array<{
    productId: string;
    title: string;
    hasCoupons: boolean;
    couponCode?: string;
    appSalePrice?: number;
    flashDeal?: boolean;
    promotionId?: string;
    campaignLabel?: string;
  }>;
};

const KEYWORDS = ['smartwatch', 'laptop', 'power bank'];
const minSignalsArg = process.argv.find((arg) => arg.startsWith('--min-signals='));
const MIN_SIGNALS = Number.parseInt((minSignalsArg || '--min-signals=0').split('=')[1] || '0', 10);

function extractProductsFromSearchResponse(response: any): any[] {
  return response?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product
    ?? response?.resp_result?.result?.products
    ?? [];
}

function extractProductsFromDetailsResponse(response: any): any[] {
  const raw = response?.aliexpress_affiliate_productdetail_get_response?.result?.products?.product
    ?? response?.result?.products?.product
    ?? response?.result?.products
    ?? [];

  if (Array.isArray(raw)) {
    return raw;
  }

  if (raw && typeof raw === 'object') {
    return [raw];
  }

  return [];
}

async function runKeywordSmoke(keyword: string): Promise<SmokeResult> {
  const client = getAliExpressClient();

  const searchResponse = await client.searchAffiliateProducts({
    keywords: keyword,
    page_size: 10,
    page_no: 1,
    target_currency: 'PLN',
    target_language: 'PL',
    ship_to_country: 'PL',
    sort: 'SALE_PRICE_ASC',
  });

  const products = extractProductsFromSearchResponse(searchResponse);
  const productIds = products
    .map((item: any) => String(item?.product_id || item?.item_id || '').trim())
    .filter(Boolean)
    .slice(0, 10);

  if (productIds.length === 0) {
    return {
      keyword,
      productsFound: 0,
      detailsFetched: 0,
      promoSignals: 0,
      samples: [],
    };
  }

  const detailsResponse = await client.getAffiliateProductDetails(productIds);
  const details = extractProductsFromDetailsResponse(detailsResponse);
  const evaluationPool = details.length > 0 ? details : products;

  const samples = evaluationPool
    .map((item: any) => {
      const promotion = parseAliExpressPromotionData(item, {
        currency: item?.target_sale_price_currency || item?.target_app_sale_price_currency || 'PLN',
        fallbackUrl: item?.product_detail_url || item?.promotion_link || '',
      });

      const campaignLabel = promotion?.promotionCampaign?.label || promotion?.promotionCampaign?.name;
      const hasAnyPromoSignal = Boolean(
        promotion.hasCoupons
        || promotion.appSalePrice
        || promotion.flashDeal
        || promotion.promotionId
        || campaignLabel
      );

      if (!hasAnyPromoSignal) {
        return null;
      }

      return {
        productId: String(item?.product_id || ''),
        title: String(item?.product_title || '').slice(0, 100),
        hasCoupons: promotion.hasCoupons,
        couponCode: promotion.couponCode,
        appSalePrice: promotion.appSalePrice,
        flashDeal: promotion.flashDeal,
        promotionId: promotion.promotionId,
        campaignLabel,
      };
    })
    .filter(Boolean) as SmokeResult['samples'];

  return {
    keyword,
    productsFound: products.length,
    detailsFetched: details.length,
    promoSignals: samples.length,
    samples: samples.slice(0, 5),
  };
}

async function main() {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;

  if (!appKey || !appSecret) {
    console.error('[smoke-aliexpress-promotions] Missing ALIEXPRESS_APP_KEY or ALIEXPRESS_APP_SECRET in .env.local');
    process.exit(1);
  }

  const results: SmokeResult[] = [];

  for (const keyword of KEYWORDS) {
    try {
      const result = await runKeywordSmoke(keyword);
      results.push(result);
    } catch (error) {
      console.error(`[smoke-aliexpress-promotions] Failed for keyword "${keyword}":`, error);
      results.push({
        keyword,
        productsFound: 0,
        detailsFetched: 0,
        promoSignals: 0,
        samples: [],
      });
    }
  }

  const totalSignals = results.reduce((sum, item) => sum + item.promoSignals, 0);

  console.log(JSON.stringify({
    status: totalSignals > 0 ? 'ok' : 'warning',
    checkedKeywords: KEYWORDS.length,
    minSignals: MIN_SIGNALS,
    totalSignals,
    results,
  }, null, 2));

  if (totalSignals === 0) {
    console.warn('[smoke-aliexpress-promotions] No promotion signals found in current sample. API may currently return neutral products.');
  }

  if (MIN_SIGNALS > 0 && totalSignals < MIN_SIGNALS) {
    console.error(`[smoke-aliexpress-promotions] totalSignals=${totalSignals} is below required minSignals=${MIN_SIGNALS}`);
    process.exit(2);
  }
}

main().catch((error) => {
  console.error('[smoke-aliexpress-promotions] Fatal error:', error);
  process.exit(1);
});