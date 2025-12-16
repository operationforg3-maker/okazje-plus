// @ts-nocheck
import type { Deal, Product, ProductImageEntry, ProductRatingCard, ProductRatingSources } from '@/lib/types';

type ProductMetadata = NonNullable<Product['metadata']>;
type DealMetadata = NonNullable<Deal['metadata']>;

const FALLBACK_IMAGE = '/icon_okazjeplus.svg'; // Używamy istniejącej ikony jako fallback
const FALLBACK_URL = '#';
const FALLBACK_CATEGORY = 'inne';
const PRODUCT_METADATA_SOURCES: ProductMetadata['source'][] = ['aliexpress', 'manual', 'csv'];
const DEAL_SOURCES: readonly NonNullable<Deal['source']>[] = [
  'manual',
  'aliexpress',
  'csv',
  'pepper',
  'mydealz',
  'reddit',
  'other',
] as const;

const ensureString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
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

const sanitizeProductMetadata = (raw: any): Product['metadata'] | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = ensureOptionalString(raw.source);
  const normalizedSource = source && PRODUCT_METADATA_SOURCES.includes(source as ProductMetadata['source'])
    ? (source as ProductMetadata['source'])
    : 'manual';
  const metadata: ProductMetadata = {
    source: normalizedSource,
    originalId: ensureOptionalString(raw.originalId),
    importedAt: ensureOptionalString(raw.importedAt),
    importedBy: ensureOptionalString(raw.importedBy),
    orders: ensureOptionalNumber(raw.orders),
    shipping: ensureOptionalString(raw.shipping),
    merchant: ensureOptionalString(raw.merchant),
    merchantId: ensureOptionalString(raw.merchantId),
    brand: ensureOptionalString(raw.brand),
    rawDataStored: raw.rawDataStored === undefined ? undefined : ensureBoolean(raw.rawDataStored),
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
    importedAt: ensureOptionalString(raw.importedAt),
    originalUrl: ensureOptionalString(raw.originalUrl),
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

  const nameFallback = ensureString(raw.name || 'Produkt', 'Produkt');
  const descriptionFallback = ensureString(raw.description || '', '');
  const longDescriptionFallback = ensureString(raw.longDescription || raw.description || '', '');

  return {
    name: nameFallback,
    description: descriptionFallback,
    longDescription: longDescriptionFallback,
    title: raw.title ? sanitizeLocalizedText(raw.title, nameFallback) : sanitizeLocalizedText(raw.name, 'Produkt'),
    shortDescription: raw.shortDescription ? sanitizeLocalizedText(raw.shortDescription, descriptionFallback) : sanitizeLocalizedText(raw.description, ''),
    fullDescription: raw.fullDescription ? sanitizeLocalizedText(raw.fullDescription, longDescriptionFallback) : sanitizeLocalizedText(raw.longDescription || raw.description, ''),
    seoDescription: raw.seoDescription ? sanitizeLocalizedText(raw.seoDescription, descriptionFallback) : undefined,
    image: ensureString(raw.image, FALLBACK_IMAGE) || FALLBACK_IMAGE,
    imageHint: ensureString(raw.imageHint || raw.name || 'produkt', 'produkt'),
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
    seoKeywords: ensureStringArray(raw.seoKeywords, 30),
    metaTitle: ensureOptionalString(raw.metaTitle),
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
  const status = ensureString(raw.status, 'draft');
  const normalizedStatus: Deal['status'] = ['draft', 'approved', 'rejected'].includes(status)
    ? (status as Deal['status'])
    : 'draft';
  const sourceValue = ensureOptionalString(raw.source);
  const normalizedSource = sourceValue && DEAL_SOURCES.includes(sourceValue as NonNullable<Deal['source']>)
    ? (sourceValue as NonNullable<Deal['source']>)
    : undefined;

  return {
    title: ensureString(raw.title, 'Oferta'),
    description: ensureString(raw.description, ''),
    price: ensureNumber(raw.price, 0),
    originalPrice: ensureOptionalNumber(raw.originalPrice),
    link: ensureString(raw.link, FALLBACK_URL) || FALLBACK_URL,
    image: ensureString(raw.image, FALLBACK_IMAGE) || FALLBACK_IMAGE,
    imageHint: ensureString(raw.imageHint || raw.title || 'okazja', 'okazja'),
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
    merchant: ensureOptionalString(raw.merchant),
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
