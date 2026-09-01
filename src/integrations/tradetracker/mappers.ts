/**
 * TradeTracker Data Mappers
 * Maps TradeTracker feed items and vouchers to internal RawProduct models for SmartHarvester
 */

import { convertToPLN } from '@/lib/currency-exchange';
import { extractDimensionsFromTitle } from '@/lib/automation/identity-matcher';
import {
  TradeTrackerProductFeedItem,
  TradeTrackerVoucherItem,
} from './types';

/**
 * Raw product format expected by SmartHarvester
 */
export interface RawProduct {
  title: string;
  description?: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  currency: string;
  shippingCost: number;
  shippingDays: number;
  shippingVerified?: boolean;
  sourceProductId: string;
  sourceUrl: string;
  matchedL1Slug?: string;
  matchedL2Slug?: string;
  matchedL3Slug?: string;
  originalCategoryName?: string;
  merchantName?: string;
  merchantRating?: number;
  specs?: Record<string, string>;
  attributes?: Array<{ name: string; value: string }>;
  discountPercent?: number;
  couponCode?: string;
  expiryDate?: string;
  conditions?: string[];
  freeShipping?: boolean;
  minOrderValue?: number;
  rating?: number;
  ratingCount?: number;
  images?: string[];
  ean?: string;
  gtin?: string;
  upc?: string;
  mpn?: string;
  sku?: string;
  offerMeta?: {
    promotionType?: 'offer' | 'voucher';
    terms?: string;
    previewUrl?: string;
    hasCoupons?: boolean;
  };
}

/**
 * Maps a TradeTracker product feed item into RawProduct for Harvester
 */
export async function mapTradeTrackerProductToRawProduct(
  item: TradeTrackerProductFeedItem,
  searchQuery?: string
): Promise<RawProduct | null> {
  const title = (item.name || '').trim();
  if (!title) return null;

  const imageUrl = (item.imageURL || '').trim();
  const sourceUrl = (item.productURL || item.trackingURL || '').trim();
  if (!imageUrl && !sourceUrl) return null;

  const currency = (item.currency || 'PLN').toUpperCase();
  const pricePLN = await convertToPLN(item.price, currency);
  const originalPricePLN = item.fromPrice && item.fromPrice > item.price
    ? await convertToPLN(item.fromPrice, currency)
    : undefined;

  const shippingPLN = item.shippingCosts && item.shippingCosts > 0
    ? await convertToPLN(item.shippingCosts, currency)
    : 0;

  // Extract specs from title & properties
  const titleSpecs = extractDimensionsFromTitle(title);
  const combinedSpecs: Record<string, string> = {
    ...titleSpecs,
    ...(item.properties || {}),
  };

  if (item.brand) {
    combinedSpecs['Marka'] = item.brand;
  }
  if (item.deliveryTime) {
    combinedSpecs['Czas dostawy'] = item.deliveryTime;
  }

  const categoryHierarchy = (item.categories || []).filter(Boolean);
  const originalCategoryName = categoryHierarchy.length > 0
    ? categoryHierarchy.join(' > ')
    : (item.category || undefined);

  // Gallery images
  const allImages = Array.from(new Set([
    imageUrl,
    ...(item.additionalImages || []),
  ].filter(Boolean)));

  const discountPercent = item.discount && item.discount > 0
    ? item.discount
    : (originalPricePLN && originalPricePLN > pricePLN
      ? Math.round(((originalPricePLN - pricePLN) / originalPricePLN) * 100)
      : undefined);

  return {
    title,
    description: item.description || item.shortDescription || undefined,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    images: allImages.length > 0 ? allImages : undefined,
    price: pricePLN,
    originalPrice: originalPricePLN && originalPricePLN > pricePLN ? originalPricePLN : undefined,
    currency: 'PLN',
    shippingCost: shippingPLN,
    shippingDays: item.deliveryDays || 2,
    shippingVerified: shippingPLN === 0,
    sourceProductId: item.productID || `tt_${Date.now()}`,
    sourceUrl: sourceUrl || 'https://tradetracker.com',
    merchantName: item.merchantName || item.brand || 'TradeTracker Partner',
    merchantRating: item.rating ? Number(item.rating) : 4.8,
    specs: Object.keys(combinedSpecs).length > 0 ? combinedSpecs : undefined,
    discountPercent: discountPercent && discountPercent > 0 ? discountPercent : undefined,
    couponCode: item.voucherCode || undefined,
    freeShipping: shippingPLN === 0,
    rating: item.rating || 4.7,
    ratingCount: item.ratingCount || 50,
    ean: item.ean || undefined,
    gtin: item.gtin || undefined,
    upc: item.upc || undefined,
    mpn: item.mpn || undefined,
    sku: item.sku || undefined,
    originalCategoryName,
    offerMeta: item.voucherCode ? {
      promotionType: 'offer',
      hasCoupons: true,
      previewUrl: sourceUrl,
    } : undefined,
  };
}

/**
 * Maps a TradeTracker voucher/coupon into RawProduct for Harvester
 */
export async function mapTradeTrackerVoucherToRawProduct(
  voucher: TradeTrackerVoucherItem
): Promise<RawProduct | null> {
  const title = (voucher.name || '').trim();
  if (!title) return null;

  const sourceUrl = (voucher.url || '').trim();
  const imageUrl = voucher.imageURL || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80';

  let discountPercent = voucher.discountType === 'percentage' ? voucher.discount : undefined;
  let price = 0;
  let originalPrice = undefined;

  if (voucher.minimumOrderValue && voucher.minimumOrderValue > 0) {
    const minOrder = voucher.minimumOrderValue;
    if (voucher.discount && voucher.discountType === 'fixed') {
      price = Math.max(0, minOrder - voucher.discount);
      originalPrice = minOrder;
      discountPercent = Math.round((voucher.discount / minOrder) * 100);
    } else if (voucher.discount && voucher.discountType === 'percentage') {
      price = minOrder * (1 - voucher.discount / 100);
      originalPrice = minOrder;
    }
  }

  return {
    title,
    description: voucher.description || voucher.termsAndConditions || undefined,
    imageUrl,
    price: price > 0 ? price : 0,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
    currency: voucher.currency || 'PLN',
    shippingCost: voucher.discountType === 'free_shipping' ? 0 : 0,
    shippingDays: 1,
    shippingVerified: voucher.discountType === 'free_shipping',
    freeShipping: voucher.discountType === 'free_shipping',
    sourceProductId: `tt_voucher_${voucher.id}`,
    sourceUrl: sourceUrl || 'https://tradetracker.com',
    merchantName: voucher.campaignName || 'TradeTracker Partner',
    merchantRating: 4.9,
    discountPercent: discountPercent && discountPercent > 0 ? discountPercent : undefined,
    couponCode: voucher.code || undefined,
    expiryDate: voucher.validToDate || undefined,
    conditions: voucher.termsAndConditions ? [voucher.termsAndConditions] : undefined,
    minOrderValue: voucher.minimumOrderValue || undefined,
    originalCategoryName: voucher.category || 'Kody Rabatowe i Promocje',
    offerMeta: {
      promotionType: 'voucher',
      terms: voucher.termsAndConditions,
      previewUrl: sourceUrl,
      hasCoupons: Boolean(voucher.code),
    },
  };
}
