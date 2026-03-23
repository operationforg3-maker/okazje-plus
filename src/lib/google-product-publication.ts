import { DealM6, Product, ProductCore } from '@/lib/types';
import { containsPromotionalTextForGoogle } from '@/lib/google-product-text';

type ProductLike = Product | ProductCore;

export interface GoogleProductPublicationState {
  eligible: boolean;
  reasons: string[];
  priceAmount?: number;
  imageUrl?: string;
}

function isAbsoluteHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isOverlayLikeImageUrl(url: string): boolean {
  return /(overlay|watermark|badge|promo|sale-banner|sticker|label)/i.test(url);
}

function getLocalizedString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const candidate = localized.pl || localized.en || localized.de || localized.fr || localized.es || localized.uk;
    return typeof candidate === 'string' ? candidate.trim() : '';
  }

  return '';
}

function getProductTitle(product: ProductLike, isM6: boolean): string {
  if (isM6) {
    return getLocalizedString((product as ProductCore).title);
  }

  const legacy = product as Product;
  return legacy.name?.trim() || getLocalizedString(legacy.title);
}

function hasPromotionalAttributeText(product: ProductLike, isM6: boolean): boolean {
  if (isM6) {
    const core = product as ProductCore;
    const specs = Object.entries(core.specs || {}).flatMap(([key, value]) => [key, value]);
    const structured = Array.isArray(core.specificationsStructured)
      ? core.specificationsStructured.flatMap((item) => [item?.label, item?.value])
      : [];
    const attributes = Array.isArray(core.attributes)
      ? core.attributes.flatMap((item) => [item?.name, item?.value])
      : [];
    const tags = Array.isArray(core.searchTags) ? core.searchTags : [];

    return [...specs, ...structured, ...attributes, ...tags].some((value) => containsPromotionalTextForGoogle(value));
  }

  const legacy = product as Product;
  const tags = Array.isArray(legacy.seoKeywords) ? legacy.seoKeywords : [];
  const localizedTitle = getLocalizedString(legacy.title);
  return [legacy.name, localizedTitle, ...tags].some((value) => containsPromotionalTextForGoogle(value));
}

function getCandidateImages(product: ProductLike, isM6: boolean): string[] {
  if (isM6) {
    const core = product as ProductCore;
    return [core.imageUrl, ...(Array.isArray(core.images) ? core.images : [])].filter(isAbsoluteHttpUrl);
  }

  const legacy = product as Product;
  return [legacy.image].filter(isAbsoluteHttpUrl);
}

function getBestDealTotal(deals: DealM6[]): number | undefined {
  const totals = deals
    .map((deal) => Number(deal?.price?.amount || 0) + Number(deal?.shipping?.cost || 0))
    .filter((amount) => Number.isFinite(amount) && amount > 0);

  if (totals.length === 0) {
    return undefined;
  }

  return Math.min(...totals);
}

function getPriceAmount(product: ProductLike, isM6: boolean, deals: DealM6[] = []): number | undefined {
  if (isM6) {
    const core = product as ProductCore;
    const fromDeals = getBestDealTotal(deals);
    const fallback = Number(core.bestTotalPrice || core.bestPrice?.amount || 0);
    const amount = fromDeals ?? fallback;
    return Number.isFinite(amount) && amount > 0 ? amount : undefined;
  }

  const legacy = product as Product;
  const rawPrice = typeof legacy.price === 'number' ? legacy.price : Number((legacy.price as any)?.amount || 0);
  return Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : undefined;
}

export function getGoogleProductPublicationState(params: {
  product: ProductLike | null | undefined;
  isM6: boolean;
  deals?: DealM6[];
}): GoogleProductPublicationState {
  const { product, isM6, deals = [] } = params;

  if (!product) {
    return {
      eligible: false,
      reasons: ['missing_product'],
    };
  }

  const reasons: string[] = [];
  const status = String((product as any).status || '');
  if (status !== 'approved') {
    reasons.push('status_not_approved');
  }

  if ((product as any)?.metadata?.offerOnly === true) {
    reasons.push('offer_only_product');
  }

  const title = getProductTitle(product, isM6);
  if (title.length < 3) {
    reasons.push('missing_title');
  }

  if (containsPromotionalTextForGoogle(title) || hasPromotionalAttributeText(product, isM6)) {
    reasons.push('promotional_text_detected');
  }

  const priceAmount = getPriceAmount(product, isM6, deals);
  if (!priceAmount) {
    reasons.push('missing_valid_price');
  }

  const candidateImages = getCandidateImages(product, isM6);
  const cleanImages = candidateImages.filter((imageUrl) => !isOverlayLikeImageUrl(imageUrl));
  const imageUrl = cleanImages[0] || candidateImages[0];

  if (!imageUrl) {
    reasons.push('missing_image');
  }

  if (imageUrl && isOverlayLikeImageUrl(imageUrl) && cleanImages.length === 0) {
    reasons.push('overlay_like_image');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    priceAmount,
    imageUrl,
  };
}