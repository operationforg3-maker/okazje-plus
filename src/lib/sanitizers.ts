// @ts-nocheck
import type { Deal, Product, ProductImageEntry, ProductRatingCard, ProductRatingSources, LocalizedText } from '@/lib/types';
import { sanitizeTextForGoogleAttribute, sanitizeTextForGoogleTitle } from '@/lib/google-product-text';

type ProductMetadata = NonNullable<Product['metadata']>;
type DealMetadata = NonNullable<Deal['metadata']>;

const FALLBACK_IMAGE = '/icon_okazjeplus.svg'; // Używamy istniejącej ikony jako fallback
const FALLBACK_URL = '#';
const FALLBACK_CATEGORY = 'inne';
// Unified source types for Products (from metadata) and Deals (from source field)
const PRODUCT_METADATA_SOURCES: ProductMetadata['source'][] = ['aliexpress', 'manual', 'csv', 'amazon', 'allegro', 'ebay'];
const DEAL_SOURCES: readonly NonNullable<Deal['source']>[] = [
  'manual',
  'aliexpress',
  'csv',
  'amazon',
  'allegro',
  'pepper',
  'mydealz',
  'reddit',
  'auto-scraped',
  'other',
] as const;

const ensureString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Handle Firestore Timestamp object (both Client SDK and Admin SDK)
  // Client SDK: has 'toDate' method
  // Admin SDK: is instance of admin.firestore.Timestamp (has _seconds, _nanoseconds)
  if (value && typeof value === 'object') {
    // Try Client SDK Timestamp first
    if ('toDate' in value && typeof (value as any).toDate === 'function') {
      try {
        return (value as any).toDate().toISOString();
      } catch (e) {
        // Fallthrough to next check
      }
    }
    // Try Admin SDK Timestamp (has _seconds and _nanoseconds)
    if ('_seconds' in value && typeof (value as any)._seconds === 'number') {
      try {
        const seconds = (value as any)._seconds;
        const nanos = (value as any)._nanoseconds || 0;
        const date = new Date(seconds * 1000 + nanos / 1000000);
        return date.toISOString();
      } catch (e) {
        // Fallthrough
      }
    }
  }
  return fallback;
};

const ensureOptionalString = (value: unknown): string | undefined => {
  const str = ensureString(value, '');
  return str.length > 0 ? str : undefined;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const ensureNumber = (value: unknown, fallback = 0): number => {
  const parsed = toNumber(value);
  return parsed === null ? fallback : parsed;
};

const ensureOptionalNumber = (value: unknown): number | undefined => {
  const parsed = toNumber(value);
  return parsed === null ? undefined : parsed;
};

const ensurePrice = (value: unknown): number | { amount: number; currency: string } => {
  // Handle M6 price object { amount, currency }
  if (value && typeof value === 'object' && 'amount' in value) {
    const amount = ensureNumber((value as any).amount, 0);
    const currency = ensureString((value as any).currency, 'PLN');
    return { amount, currency };
  }
  // Handle legacy number
  return ensureNumber(value, 0);
};

const ensureBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (['true', '1', 'yes', 'tak'].includes(normalized)) return true;
    if (['false', '0', 'no', 'nie'].includes(normalized)) return false;
  }
  return fallback;
};

const ensureStringArray = (value: unknown, max = 50): string[] => {
  if (!Array.isArray(value)) return [];
  const normalized: string[] = [];
  for (const entry of value) {
    if (normalized.length >= max) break;
    const str = ensureString(entry, '');
    if (str) normalized.push(str);
  }
  return normalized;
};

const sanitizeOptionalText = (value: unknown, cleaner: (value: string) => string): string | undefined => {
  const normalized = ensureOptionalString(value);
  if (!normalized) return undefined;
  const cleaned = cleaner(normalized);
  return cleaned || undefined;
};

const sanitizeLocalizedTextValues = (
  value: LocalizedText,
  cleaner: (value: string) => string
): LocalizedText => {
  const cleanedEntries = Object.entries(value || {}).map(([locale, text]) => {
    const cleaned = cleaner(ensureString(text, ''));
    return [locale, cleaned] as const;
  });

  return Object.fromEntries(cleanedEntries) as LocalizedText;
};

const extractImageCandidate = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const parsed = ensureString(value, '');
    return parsed || undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractImageCandidate(entry);
      if (extracted) return extracted;
    }
    return undefined;
  }
  if (typeof value === 'object') {
    const src = ensureOptionalString((value as any).src)
      || ensureOptionalString((value as any).url)
      || ensureOptionalString((value as any).image)
      || ensureOptionalString((value as any).imageUrl);
    return src;
  }
  return undefined;
};

const resolveDealImageFallback = (raw: any): string => {
  const candidates: unknown[] = [
    raw?.image,
    raw?.imageUrl,
    raw?.mainImage,
    raw?.product_main_image_url,
    raw?.thumbnail,
    raw?.images,
    raw?.gallery,
    raw?.metadata?.image,
    raw?.metadata?.imageUrl,
    raw?.metadata?.mainImage,
    raw?.importMetadata?.image,
    raw?.importMetadata?.imageUrl,
    raw?.importMetadata?.mainImage,
  ];

  for (const candidate of candidates) {
    const resolved = extractImageCandidate(candidate);
    if (resolved) return resolved;
  }

  return FALLBACK_IMAGE;
};

const pruneObject = <T extends Record<string, any>>(obj?: T): T | undefined => {
  if (!obj) return undefined;
  const record = obj as Record<string, any>;
  Object.keys(record).forEach((key) => {
    if (record[key] === undefined) delete record[key];
  });
  return Object.keys(record).length === 0 ? undefined : (obj as T);
};

const sanitizeRatingCard = (raw: any): ProductRatingCard => ({
  average: ensureNumber(raw?.average, 0),
  count: ensureNumber(raw?.count, 0),
  durability: ensureNumber(raw?.durability, 0),
  easeOfUse: ensureNumber(raw?.easeOfUse, 0),
  valueForMoney: ensureNumber(raw?.valueForMoney, 0),
  versatility: ensureNumber(raw?.versatility, 0),
});

const sanitizeRatingSources = (raw: any): ProductRatingSources | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;

  const editorial = (() => {
    const average = ensureOptionalNumber(raw.editorial?.average);
    if (average === undefined) return undefined;
    return pruneObject({
      average,
      count: ensureOptionalNumber(raw.editorial?.count),
      updatedAt: ensureOptionalString(raw.editorial?.updatedAt),
    });
  })();

  const users = (() => {
    const average = ensureOptionalNumber(raw.users?.average);
    if (average === undefined) return undefined;
    return {
      average,
      count: Math.max(0, Math.round(ensureNumber(raw.users?.count, 0))),
      updatedAt: ensureOptionalString(raw.users?.updatedAt),
    } satisfies ProductRatingSources['users'];
  })();

  const external = (() => {
    const average = ensureOptionalNumber(raw.external?.average);
    if (average === undefined) return undefined;
    return pruneObject({
      average,
      count: ensureOptionalNumber(raw.external?.count),
      source: ensureOptionalString(raw.external?.source),
      updatedAt: ensureOptionalString(raw.external?.updatedAt),
    });
  })();

  if (!editorial && !users && !external) return undefined;
  return {
    ...(editorial ? { editorial } : {}),
    ...(users ? { users } : {}),
    ...(external ? { external } : {}),
  };
};

const sanitizeGallery = (raw: any): ProductImageEntry[] => {
  if (!Array.isArray(raw)) return [];
  const normalized: ProductImageEntry[] = [];
  raw.forEach((entry, index) => {
    if (!entry) return;
    if (typeof entry === 'string') {
      const src = ensureString(entry, '');
      if (!src) return;
      normalized.push({
        id: `legacy-${index}-${src.substring(0, 12)}`,
        type: 'url',
        src,
        isPrimary: index === 0,
        addedAt: new Date().toISOString(),
      });
      return;
    }
    if (typeof entry === 'object') {
      const src = ensureString(entry.src, '');
      if (!src) return;
      normalized.push({
        id: ensureString(entry.id, `img-${index}`),
        type: entry.type === 'storage' ? 'storage' : 'url',
        src,
        alt: ensureOptionalString(entry.alt),
        isPrimary: Boolean(entry.isPrimary),
        source: ensureOptionalString(entry.source) as ProductImageEntry['source'],
        addedAt: ensureOptionalString(entry.addedAt),
      });
    }
  });
  return normalized;
};

const sanitizeSpecifications = (raw: any): Array<{ key?: string; name?: string; value: string; unit?: string }> | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const normalized = raw
    .map((spec) => {
      if (!spec || typeof spec !== 'object') return null;
      const value = ensureString(spec.value, '');
      if (!value) return null;
      return {
        key: ensureOptionalString(spec.key),
        name: ensureOptionalString(spec.name),
        value,
        unit: ensureOptionalString(spec.unit),
      };
    })
    .filter(Boolean) as Array<{ key?: string; name?: string; value: string; unit?: string }>;
  return normalized.length > 0 ? normalized : undefined;
};

const sanitizePriceHistory = (raw: any): Array<{ price: number; currency: string; timestamp: string; source: string }> | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const normalized = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const price = ensureOptionalNumber(entry.price);
      const currency = ensureOptionalString(entry.currency);
      const timestamp = ensureOptionalString(entry.timestamp);
      if (price === undefined || !currency || !timestamp) return null;
      return {
        price,
        currency,
        timestamp,
        source: ensureString(entry.source, 'manual'),
      };
    })
    .filter(Boolean) as Array<{ price: number; currency: string; timestamp: string; source: string }>;
  return normalized.length > 0 ? normalized : undefined;
};

const sanitizeProductMetadata = (raw: any): Product['metadata'] | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = ensureOptionalString(raw.source);
  const normalizedSource = source && PRODUCT_METADATA_SOURCES.includes(source as ProductMetadata['source'])
    ? (source as ProductMetadata['source'])
    : 'manual';
  const metadata: ProductMetadata = {
    source: normalizedSource,
    originalId: ensureOptionalString(raw.originalId),
    createdAt: ensureOptionalString(raw.createdAt),
    importedAt: ensureOptionalString(raw.importedAt),
    importedBy: ensureOptionalString(raw.importedBy),
    locale: ensureOptionalString(raw.locale),
    orders: ensureOptionalNumber(raw.orders),
    shipping: ensureOptionalString(raw.shipping),
    merchant: ensureOptionalString(raw.merchant),
    merchantId: ensureOptionalString(raw.merchantId),
    brand: ensureOptionalString(raw.brand),
    rawDataStored: raw.rawDataStored === undefined ? undefined : ensureBoolean(raw.rawDataStored),
    currencyRate: ensureOptionalNumber(raw.currencyRate),
    qualityScore: ensureOptionalNumber(raw.qualityScore),
    priceHistory: sanitizePriceHistory(raw.priceHistory),
    promotionId: ensureOptionalString(raw.promotionId),
    commissionRate: ensureOptionalNumber(raw.commissionRate),
    evaluateCount: ensureOptionalNumber(raw.evaluateCount),
    evaluateRate: ensureOptionalString(raw.evaluateRate),
    sellerRating: ensureOptionalNumber(raw.sellerRating),
    returnPolicy: ensureOptionalString(raw.returnPolicy),
    hotProduct: raw.hotProduct === undefined ? undefined : ensureBoolean(raw.hotProduct),
    flashDeal: raw.flashDeal === undefined ? undefined : ensureBoolean(raw.flashDeal),
    platformProductType: ensureOptionalString(raw.platformProductType),
    stockStatus: ensureOptionalString(raw.stockStatus) as ProductMetadata['stockStatus'],
    stockLevel: ensureOptionalNumber(raw.stockLevel),
    specifications: sanitizeSpecifications(raw.specifications),
    productVideoUrl: ensureOptionalString(raw.productVideoUrl),
    warehouse: ensureOptionalString(raw.warehouse),
    deliveryTime: ensureOptionalString(raw.deliveryTime),
    freeShipping: raw.freeShipping === undefined ? undefined : ensureBoolean(raw.freeShipping),
    shippingCost: ensureOptionalNumber(raw.shippingCost),
    shippingMethod: ensureOptionalString(raw.shippingMethod),
    promotionCampaign:
      raw.promotionCampaign && typeof raw.promotionCampaign === 'object'
        ? raw.promotionCampaign
        : undefined,
  };
  pruneObject(metadata);
  return metadata;
};

const sanitizeProductAi = (raw: any): Product['ai'] | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const ai: Product['ai'] = {
    suggestedCategoryPath: ensureStringArray(raw.suggestedCategoryPath),
    softDuplicateOf: ensureOptionalString(raw.softDuplicateOf),
    softDuplicateScore: ensureOptionalNumber(raw.softDuplicateScore),
    enrichmentConfidence: ensureOptionalNumber(raw.enrichmentConfidence),
    flags: ensureStringArray(raw.flags, 10),
    quality:
      raw.quality && typeof raw.quality === 'object'
        ? {
            score: ensureNumber(raw.quality.score, 0),
            recommendation: ['approve', 'review', 'reject'].includes(
              ensureString(raw.quality.recommendation, 'review')
            )
              ? (ensureString(raw.quality.recommendation, 'review') as 'approve' | 'review' | 'reject')
              : 'review',
            factors: {
              priceQuality: ensureNumber(raw.quality.factors?.priceQuality, 0),
              discountLegitimacy: ensureNumber(raw.quality.factors?.discountLegitimacy, 0),
              merchantTrust: ensureNumber(raw.quality.factors?.merchantTrust, 0),
              productPopularity: ensureNumber(raw.quality.factors?.productPopularity, 0),
              contentQuality: ensureNumber(raw.quality.factors?.contentQuality, 0),
            },
            warnings: ensureStringArray(raw.quality.warnings, 10),
            reasoning: ensureString(raw.quality.reasoning, ''),
            scoredAt: ensureString(raw.quality.scoredAt, ''),
          }
        : undefined,
    titleNormalization: raw.titleNormalization,
    categoryMapping: raw.categoryMapping,
    enrichment:
      raw.enrichment && typeof raw.enrichment === 'object'
        ? {
            features: ensureStringArray(raw.enrichment.features, 10),
            keywords: ensureStringArray(raw.enrichment.keywords, 20),
          }
        : undefined,
  };
  return pruneObject(ai) as Product['ai'];
};

const sanitizeDealMetadata = (raw: any): Deal['metadata'] | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const metadata: DealMetadata = {
    source: ensureOptionalString(raw.source),
    originalId: ensureOptionalString(raw.originalId),
    importedAt: ensureOptionalString(raw.importedAt),
    importedBy: ensureOptionalString(raw.importedBy),
    originalUrl: ensureOptionalString(raw.originalUrl),
    locale: ensureOptionalString(raw.locale),
    promotionId: ensureOptionalString(raw.promotionId),
    commissionRate: ensureOptionalNumber(raw.commissionRate),
    evaluateCount: ensureOptionalNumber(raw.evaluateCount),
    evaluateRate: ensureOptionalString(raw.evaluateRate),
    sellerRating: ensureOptionalNumber(raw.sellerRating),
    returnPolicy: ensureOptionalString(raw.returnPolicy),
    hotProduct: raw.hotProduct === undefined ? undefined : ensureBoolean(raw.hotProduct),
    flashDeal: raw.flashDeal === undefined ? undefined : ensureBoolean(raw.flashDeal),
    platformProductType: ensureOptionalString(raw.platformProductType),
    stockStatus: ensureOptionalString(raw.stockStatus) as DealMetadata['stockStatus'],
    stockLevel: ensureOptionalNumber(raw.stockLevel),
    specifications: sanitizeSpecifications(raw.specifications),
    productVideoUrl: ensureOptionalString(raw.productVideoUrl),
    warehouse: ensureOptionalString(raw.warehouse),
    deliveryTime: ensureOptionalString(raw.deliveryTime),
    shippingMethod: ensureOptionalString(raw.shippingMethod),
    merchant: ensureOptionalString(raw.merchant),
    merchantId: ensureOptionalString(raw.merchantId),
    orders: ensureOptionalNumber(raw.orders),
    brand: ensureOptionalString(raw.brand),
    promotionCampaign:
      raw.promotionCampaign && typeof raw.promotionCampaign === 'object'
        ? raw.promotionCampaign
        : undefined,
    priceHistory: sanitizePriceHistory(raw.priceHistory),
  };
  return pruneObject(metadata) as Deal['metadata'];
};

const sanitizeLocalizedText = (raw: any, fallback: string): { pl: string; en: string; [key: string]: string | undefined } => {
  if (typeof raw === 'string' && raw.trim()) {
    return { pl: raw.trim(), en: raw.trim() };
  }
  if (raw && typeof raw === 'object') {
    const pl = ensureOptionalString(raw.pl) || fallback;
    const en = ensureOptionalString(raw.en) || pl;
    const result: Record<string, string | undefined> = { pl, en };
    if (raw.de) result.de = ensureOptionalString(raw.de);
    if (raw.fr) result.fr = ensureOptionalString(raw.fr);
    if (raw.es) result.es = ensureOptionalString(raw.es);
    return result as { pl: string; en: string; [key: string]: string | undefined };
  }
  return { pl: fallback, en: fallback };
};

export const sanitizeProductPayload = (raw: Partial<Product>): Omit<Product, 'id'> => {
  const gallery = sanitizeGallery(raw.gallery);
  const ratingCard = sanitizeRatingCard(raw.ratingCard);
  const ratingSources = sanitizeRatingSources(raw.ratingSources);
  const metadata = sanitizeProductMetadata(raw.metadata);
  const ai = sanitizeProductAi(raw.ai);

  const status = ensureString(raw.status, 'draft');
  const normalizedStatus: Product['status'] = ['draft', 'approved', 'rejected'].includes(status)
    ? (status as Product['status'])
    : 'draft';

  const nameFallback = sanitizeTextForGoogleTitle(ensureString(raw.name || 'Produkt', 'Produkt')) || 'Produkt';
  const descriptionFallback = ensureString(raw.description || '', '');
  const longDescriptionFallback = ensureString(raw.longDescription || raw.description || '', '');
  const sanitizedTitle = sanitizeLocalizedTextValues(
    raw.title ? sanitizeLocalizedText(raw.title, nameFallback) : sanitizeLocalizedText(raw.name, 'Produkt'),
    sanitizeTextForGoogleTitle
  );

  return {
    name: nameFallback,
    description: descriptionFallback,
    longDescription: longDescriptionFallback,
    title: sanitizedTitle,
    shortDescription: raw.shortDescription ? sanitizeLocalizedText(raw.shortDescription, descriptionFallback) : sanitizeLocalizedText(raw.description, ''),
    fullDescription: raw.fullDescription ? sanitizeLocalizedText(raw.fullDescription, longDescriptionFallback) : sanitizeLocalizedText(raw.longDescription || raw.description, ''),
    seoDescription: raw.seoDescription ? sanitizeLocalizedText(raw.seoDescription, descriptionFallback) : undefined,
    image: ensureString(raw.image, FALLBACK_IMAGE) || FALLBACK_IMAGE,
    imageHint: sanitizeTextForGoogleAttribute(ensureString(raw.imageHint || raw.name || 'produkt', 'produkt')) || 'produkt',
    affiliateUrl: ensureString(raw.affiliateUrl, FALLBACK_URL) || FALLBACK_URL,
    translations: raw.translations,
    ratingCard,
    ratingSources,
    price: typeof raw.price === 'number' 
      ? { amount: raw.price, currency: 'PLN', shippingCost: 0, totalPrice: raw.price, freeShipping: true }
      : (raw.price || { amount: 0, currency: 'PLN', shippingCost: 0, totalPrice: 0, freeShipping: true }),
    originalPrice: ensureOptionalNumber(raw.originalPrice),
    discountPercent: ensureOptionalNumber(raw.discountPercent),
    shareCount: ensureOptionalNumber(raw.shareCount),
    mainCategorySlug: ensureString(raw.mainCategorySlug, FALLBACK_CATEGORY),
    subCategorySlug: ensureString(raw.subCategorySlug, FALLBACK_CATEGORY),
    subSubCategorySlug: ensureOptionalString(raw.subSubCategorySlug),
    status: normalizedStatus,
    category: ensureOptionalString(raw.category),
    gallery,
    seo: raw.seo,
    seoKeywords: ensureStringArray(raw.seoKeywords, 30)
      .map((keyword) => sanitizeTextForGoogleAttribute(keyword))
      .filter(Boolean),
    metaTitle: sanitizeOptionalText(raw.metaTitle, sanitizeTextForGoogleTitle),
    metaDescription: ensureOptionalString(raw.metaDescription),
    ai,
    moderation: raw.moderation,
    metadata,
    linkedDealIds: ensureStringArray(raw.linkedDealIds, 20),
  };
};

export const sanitizeProductRecord = (raw: any, id: string): Product => ({
  id,
  ...sanitizeProductPayload(raw || {}),
});

export const sanitizeDealPayload = (raw: Partial<Deal>): Omit<Deal, 'id'> => {
  // Helper to sanitize LocalizedText
  // NOTE: For deal.title, empty string fallback is intentional - components should handle missing titles
  // by pulling from linkedProductIds[0] (ProductCore) if available
  const sanitizeLocalizedText = (value: any, fallback = { pl: '', en: '', de: '' }): LocalizedText => {
    if (!value) {
      return fallback;
    }
    // If already a LocalizedText object
    if (typeof value === 'object' && !Array.isArray(value) && ('pl' in value || 'en' in value)) {
      const input = value as Record<string, unknown>;
      const normalized: Record<string, string> = {
        pl: ensureString(input.pl, fallback.pl),
        en: ensureString(input.en, fallback.en),
        de: ensureOptionalString(input.de) || fallback.de || '',
      };

      for (const [localeKey, localeValue] of Object.entries(input)) {
        if (localeKey in normalized) continue;
        const parsed = ensureOptionalString(localeValue);
        if (parsed) normalized[localeKey] = parsed;
      }

      return normalized as LocalizedText;
    }
    // If a string (legacy format), convert to LocalizedText
    if (typeof value === 'string' && value.trim()) {
      return {
        pl: value.trim(),
        en: value.trim(),
        de: value.trim(),
      };
    }
    return fallback;
  };

  const status = ensureString(raw.status, 'draft');
  const normalizedStatus: Deal['status'] = ['draft', 'approved', 'rejected'].includes(status)
    ? (status as Deal['status'])
    : 'draft';
  const sourceValue = ensureOptionalString(raw.source);
  const normalizedSource = sourceValue && DEAL_SOURCES.includes(sourceValue as NonNullable<Deal['source']>)
    ? (sourceValue as NonNullable<Deal['source']>)
    : undefined;

  const resolvedMerchant = ensureOptionalString((raw as any).merchantName) || ensureOptionalString(raw.merchant) || ensureOptionalString(raw.metadata?.merchant);
  const rawLinkCandidate = ensureOptionalString(raw.link);
  const validRawLink = rawLinkCandidate && rawLinkCandidate !== '#' ? rawLinkCandidate : undefined;
  const resolvedLink = validRawLink ||
    ensureOptionalString((raw as any).affiliateLink) ||
    ensureOptionalString((raw as any).affiliateUrl) ||
    ensureOptionalString((raw as any).dealUrl) ||
    ensureOptionalString((raw as any).sourceUrl) ||
    ensureOptionalString((raw as any).url) ||
    FALLBACK_URL;

  return {
    title: sanitizeLocalizedText(raw.title, { pl: '', en: '', de: '' }),
    description: sanitizeLocalizedText(raw.description, { pl: '', en: '', de: '' }),
    price: ensurePrice(raw.price),
    originalPrice: ensureOptionalNumber(raw.originalPrice),
    link: resolvedLink,
    image: resolveDealImageFallback(raw),
    imageHint: ensureString(raw.imageHint || (typeof raw.title === 'string' ? raw.title : (raw.title as any)?.pl) || 'okazja', 'okazja'),
    postedBy: ensureString(raw.postedBy, 'system'),
    postedAt: ensureString(raw.postedAt, new Date().toISOString()),
    voteCount: ensureNumber(raw.voteCount, 0),
    temperature: ensureNumber(raw.temperature, 0),
    commentsCount: ensureNumber(raw.commentsCount, 0),
    shareCount: ensureOptionalNumber(raw.shareCount),
    category: ensureString(raw.category, FALLBACK_CATEGORY),
    mainCategorySlug: ensureString(raw.mainCategorySlug, FALLBACK_CATEGORY),
    subCategorySlug: ensureString(raw.subCategorySlug, FALLBACK_CATEGORY),
    subSubCategorySlug: ensureOptionalString(raw.subSubCategorySlug),
    merchant: resolvedMerchant,
    merchantName: resolvedMerchant,
    shippingCost: ensureOptionalNumber(raw.shippingCost),
    status: normalizedStatus,
    createdBy: ensureOptionalString(raw.createdBy),
    linkedProductIds: ensureStringArray(raw.linkedProductIds, 20),
    externalOriginalId: ensureOptionalString(raw.externalOriginalId),
    source: normalizedSource,
    dealType: raw.dealType,
    couponCode: ensureOptionalString(raw.couponCode),
    freeShipping: raw.freeShipping === undefined ? undefined : ensureBoolean(raw.freeShipping),
    cashback: raw.cashback,
    minOrderValue: ensureOptionalNumber(raw.minOrderValue),
    stockAlert: raw.stockAlert,
    expiryDate: ensureOptionalString(raw.expiryDate),
    // Preserve external link variants used by UI and notifications.
    affiliateLink: ensureOptionalString((raw as any).affiliateLink) || resolvedLink,
    affiliateUrl: ensureString((raw as any).affiliateUrl, resolvedLink) || resolvedLink,
    dealUrl: ensureOptionalString((raw as any).dealUrl) || resolvedLink,
    sourceUrl: ensureOptionalString((raw as any).sourceUrl) || resolvedLink,
    externalUrl: ensureOptionalString((raw as any).externalUrl),
    url: ensureOptionalString((raw as any).url) || resolvedLink,
    availableQuantity: ensureOptionalNumber(raw.availableQuantity),
    limitPerUser: ensureOptionalNumber(raw.limitPerUser),
    requiresMembership: ensureOptionalString(raw.requiresMembership),
    conditions: ensureStringArray(raw.conditions, 20),
    gallery: ensureStringArray(raw.gallery, 20),
    verified: raw.verified === undefined ? undefined : ensureBoolean(raw.verified),
    verifiedAt: ensureOptionalString(raw.verifiedAt),
    verifiedBy: ensureOptionalString(raw.verifiedBy),
    tags: ensureStringArray(raw.tags, 30),
    aiQuality: raw.aiQuality,
    importMetadata: raw.importMetadata,
    metadata: sanitizeDealMetadata(raw.metadata),
  };
};

export const sanitizeDealRecord = (raw: any, id: string): Deal => ({
  id,
  ...sanitizeDealPayload(raw || {}),
});

/**
 * Sanitize ProductCore from Firestore (M6)
 * Ensures all fields are JSON-serializable primitives (strings, numbers, booleans, ISO dates)
 * Converts Firestore Timestamps to ISO strings for React rendering safety
 */
export const sanitizeProductCoreRecord = (raw: any, id: string): ProductCore => {
  const sanitizeLocalizedText = (value: any): LocalizedText => {
    if (typeof value === 'string') {
      const normalized = ensureString(value, '');
      return { pl: normalized, en: normalized, de: '' };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { pl: '', en: '', de: '' };
    }
    const result: Record<string, string | undefined> = {
      pl: ensureString((value as any).pl, ''),
      en: ensureString((value as any).en, ''),
      de: ensureOptionalString((value as any).de) || undefined,
    };

    // Preserve additional locale keys (fr/es/uk or custom locales)
    for (const [locale, localeValue] of Object.entries(value as Record<string, unknown>)) {
      if (locale in result) continue;
      const parsed = ensureOptionalString(localeValue);
      if (parsed) {
        result[locale] = parsed;
      }
    }

    return result as LocalizedText;
  };

  const sanitizeSpecs = (raw: any): Record<string, string> | undefined => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const strKey = sanitizeTextForGoogleAttribute(ensureString(key, ''));
      const strVal = sanitizeTextForGoogleAttribute(ensureString(value, ''));
      if (strKey && strVal) normalized[strKey] = strVal;
    }
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  };

  const sanitizeStatus = (statusValue: unknown): ProductCore['status'] => {
    const normalized = ensureString(statusValue, 'draft');
    if (normalized === 'pending') return 'pending_approval';
    if (normalized === 'ready_for_review') return 'pending_approval';

    const allowed: ProductCore['status'][] = ['draft', 'pending_approval', 'approved', 'rejected'];
    return allowed.includes(normalized as ProductCore['status'])
      ? (normalized as ProductCore['status'])
      : 'draft';
  };

  const sanitizeRating = (raw: any): any => {
    if (!raw || typeof raw !== 'object') return { score: 0, count: 0, provider: 'mixed' };
    return {
      score: ensureNumber(raw.score, 0),
      count: ensureNumber(raw.count, 0),
      provider: ensureString(raw.provider, 'mixed'),
    };
  };

  const sanitizeImages = (raw: any): string[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map(img => ensureString(img, '')).filter(Boolean);
  };

  const sanitizeSearchTags = (raw: any): string[] => {
    if (!Array.isArray(raw)) return [];
    return Array.from(new Set(
      raw
        .map(tag => ensureString(tag, '').toLowerCase().replace(/^[^\w\u00C0-\u024F]+|[^\w\u00C0-\u024F]+$/g, '').trim())
        .filter(tag => tag.length > 0)
    ));
  };

  const sanitizeLocalizedStringArrays = (value: any): { [locale: string]: string[] } | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const entries = Object.entries(value)
      .map(([locale, items]) => {
        const normalized = ensureStringArray(items, 30);
        return normalized.length > 0 ? [locale, normalized] : null;
      })
      .filter(Boolean) as Array<[string, string[]]>;
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  const sanitizeAttributes = (value: any): Array<{ name: string; value: string }> | undefined => {
    if (!Array.isArray(value)) return undefined;
    const normalized = value
      .map((item) => {
        const name = sanitizeOptionalText(item?.name, sanitizeTextForGoogleAttribute);
        const val = sanitizeOptionalText(item?.value, sanitizeTextForGoogleAttribute);
        return name && val ? { name, value: val } : null;
      })
      .filter(Boolean) as Array<{ name: string; value: string }>;
    return normalized.length > 0 ? normalized : undefined;
  };

  const sanitizeVariants = (value: any): ProductCore['variants'] => {
    if (!Array.isArray(value)) return undefined;
    const normalized = value
      .map((item, index) => {
        const name = ensureOptionalString(item?.name);
        const values = ensureStringArray(item?.values, 30);
        if (!name || values.length === 0) return null;
        return {
          id: ensureString(item?.id, `${name.toLowerCase().replace(/\s+/g, '-')}-${index}`),
          name,
          values,
          sku: ensureOptionalString(item?.sku),
        };
      })
      .filter(Boolean) as NonNullable<ProductCore['variants']>;
    return normalized.length > 0 ? normalized : undefined;
  };

  const sanitizeStructuredSpecifications = (value: any): ProductCore['specificationsStructured'] => {
    if (!Array.isArray(value)) return undefined;
    const normalized = value
      .map((item, index) => {
        const label = sanitizeOptionalText(item?.label, sanitizeTextForGoogleAttribute);
        const val = sanitizeOptionalText(item?.value, sanitizeTextForGoogleAttribute);
        if (!label || !val) return null;
        return {
          label,
          value: val,
          category: ensureOptionalString(item?.category) as any,
          unit: ensureOptionalString(item?.unit),
          order: ensureOptionalNumber(item?.order) ?? index,
        };
      })
      .filter(Boolean) as NonNullable<ProductCore['specificationsStructured']>;
    return normalized.length > 0 ? normalized : undefined;
  };

  const sanitizeGalleryItems = (value: any): ProductCore['gallery'] => {
    if (!Array.isArray(value)) return undefined;
    const normalized = value
      .map((item, index) => {
        const url = ensureOptionalString(item?.url);
        if (!url) return null;
        const type = ensureString(item?.type, 'IMAGE');
        return {
          url,
          type: type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
          thumbnail: ensureOptionalString(item?.thumbnail),
          alt: ensureOptionalString(item?.alt),
          order: ensureOptionalNumber(item?.order) ?? index,
        };
      })
      .filter(Boolean) as NonNullable<ProductCore['gallery']>;
    return normalized.length > 0 ? normalized : undefined;
  };

  const sanitizeLogistics = (value: any): ProductCore['logistics'] => {
    if (!value || typeof value !== 'object') return undefined;
    const deliveryDays = ensureOptionalNumber(value?.deliveryDays);
    if (deliveryDays === undefined) return undefined;
    return {
      deliveryDays,
      deliveryDaysMax: ensureOptionalNumber(value?.deliveryDaysMax),
      isFreeShipping: ensureBoolean(value?.isFreeShipping, false),
      shippingCost: ensureNumber(value?.shippingCost, 0),
      shippingCostUSD: ensureOptionalNumber(value?.shippingCostUSD),
    };
  };

  const sanitizeSeller = (value: any): ProductCore['seller'] => {
    if (!value || typeof value !== 'object') return undefined;
    const name = ensureOptionalString(value?.name);
    if (!name) return undefined;
    return {
      name,
      rating: ensureOptionalNumber(value?.rating ?? value?.score),
      followers: ensureOptionalNumber(value?.followers),
      storeUrl: ensureOptionalString(value?.storeUrl),
      storeId: ensureOptionalString(value?.storeId),
      positiveRate: ensureOptionalString(value?.positiveRate),
    };
  };

  const sanitizeBestPrice = (raw: any): any => {
    if (!raw || typeof raw !== 'object') {
      return { amount: 0, currency: 'PLN' };
    }
    return {
      amount: ensureNumber(raw.amount, 0),
      currency: ensureString(raw.currency, 'PLN'),
    };
  };

  return {
    id,
    identityHash: ensureString((raw as any).identityHash, ''),
    title: sanitizeLocalizedTextValues(sanitizeLocalizedText((raw as any).title), sanitizeTextForGoogleTitle),
    shortDescription: sanitizeLocalizedText((raw as any).shortDescription),
    fullDescription: sanitizeLocalizedText((raw as any).fullDescription || (raw as any).description),
    description: sanitizeLocalizedText((raw as any).description),
    specs: sanitizeSpecs((raw as any).specs) || {},
    coreSpecs: sanitizeSpecs((raw as any).coreSpecs),
    rawSpecs: sanitizeSpecs((raw as any).rawSpecs),
    specsLocalized:
      (raw as any).specsLocalized && typeof (raw as any).specsLocalized === 'object' && !Array.isArray((raw as any).specsLocalized)
        ? (raw as any).specsLocalized
        : undefined,
    mainCategorySlug: ensureString((raw as any).mainCategorySlug, 'inne'),
    subCategorySlug: ensureString((raw as any).subCategorySlug, 'inne'),
    subSubCategorySlug: ensureOptionalString((raw as any).subSubCategorySlug),
    imageUrl: ensureOptionalString((raw as any).imageUrl),
    images: sanitizeImages((raw as any).images),
    primaryImageHash: ensureOptionalString((raw as any).primaryImageHash),
    videoUrl: ensureOptionalString((raw as any).videoUrl),
    reviewsSummary: sanitizeLocalizedText((raw as any).reviewsSummary),
    rating: sanitizeRating((raw as any).rating),
    ratingCard: sanitizeRatingCard((raw as any).ratingCard),
    ratingSources: sanitizeRatingSources((raw as any).ratingSources),
    features: sanitizeLocalizedStringArrays((raw as any).features),
    pros: sanitizeLocalizedStringArrays((raw as any).pros),
    cons: sanitizeLocalizedStringArrays((raw as any).cons),
    bestPrice: sanitizeBestPrice((raw as any).bestPrice),
    linkedDealIds: ensureStringArray((raw as any).linkedDealIds, 100),
    searchTags: sanitizeSearchTags((raw as any).searchTags),
    seoTitle: sanitizeOptionalText((raw as any).seoTitle, sanitizeTextForGoogleTitle),
    seoDescription: ensureOptionalString((raw as any).seoDescription),
    seoTitleLocalized:
      (raw as any).seoTitleLocalized && typeof (raw as any).seoTitleLocalized === 'object'
        ? Object.fromEntries(
            Object.entries((raw as any).seoTitleLocalized).map(([locale, text]) => [locale, sanitizeTextForGoogleTitle(ensureString(text, ''))])
          )
        : undefined,
    seoDescriptionLocalized:
      (raw as any).seoDescriptionLocalized && typeof (raw as any).seoDescriptionLocalized === 'object'
        ? (raw as any).seoDescriptionLocalized
        : undefined,
    slug:
      (raw as any).slug && typeof (raw as any).slug === 'object'
        ? (raw as any).slug
        : undefined,
    status: sanitizeStatus((raw as any).status),
    createdAt: ensureString((raw as any).createdAt, new Date().toISOString()),
    updatedAt: ensureString((raw as any).updatedAt, new Date().toISOString()),
    createdBy: ensureOptionalString((raw as any).createdBy),
    approvedBy: ensureOptionalString((raw as any).approvedBy),
    metadata: typeof (raw as any).metadata === 'object' ? (raw as any).metadata : undefined,
    aiQualityScore: ensureOptionalNumber((raw as any).aiQualityScore),
    embeddings: Array.isArray((raw as any).embeddings) ? (raw as any).embeddings : undefined,
    aiRating: ensureOptionalNumber((raw as any).aiRating),
    confidence: ensureOptionalNumber((raw as any).confidence),
    warnings: ensureStringArray((raw as any).warnings, 50),
    bestDealId: ensureOptionalString((raw as any).bestDealId),
    bestDealType: ensureOptionalString((raw as any).bestDealType),
    hasCoupons: (raw as any).hasCoupons === undefined ? undefined : ensureBoolean((raw as any).hasCoupons),
    couponDealsCount: ensureOptionalNumber((raw as any).couponDealsCount),
    bestDealCouponCode: ensureOptionalString((raw as any).bestDealCouponCode),
    bestTotalPrice: ensureOptionalNumber((raw as any).bestTotalPrice),
    specificationsStructured: sanitizeStructuredSpecifications((raw as any).specificationsStructured),
    gallery: sanitizeGalleryItems((raw as any).gallery),
    logistics: sanitizeLogistics((raw as any).logistics),
    seller: sanitizeSeller((raw as any).seller),
    attributes: sanitizeAttributes((raw as any).attributes),
    variants: sanitizeVariants((raw as any).variants),
    warehouses: ensureStringArray((raw as any).warehouses, 20),
    averageMarketPrice:
      (raw as any).averageMarketPrice && typeof (raw as any).averageMarketPrice === 'object'
        ? {
            amount: ensureNumber((raw as any).averageMarketPrice.amount, 0),
            currency: ensureString((raw as any).averageMarketPrice.currency, 'PLN'),
            range: (raw as any).averageMarketPrice.range && typeof (raw as any).averageMarketPrice.range === 'object'
              ? {
                  min: ensureNumber((raw as any).averageMarketPrice.range.min, 0),
                  max: ensureNumber((raw as any).averageMarketPrice.range.max, 0),
                }
              : undefined,
          }
        : undefined,
  } as ProductCore;
};
