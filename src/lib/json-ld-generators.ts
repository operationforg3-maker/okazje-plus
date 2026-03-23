import { ProductCore, DealM6, Product, Deal } from '@/lib/types';

const BASE_URL = 'https://okazjeplus.pl';
const PRODUCT_BASE_URL = `${BASE_URL}/pl/products`;
const DEAL_BASE_URL = `${BASE_URL}/pl/deals`;

function getValidAbsoluteUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function isOverlayLikeImageUrl(url: string): boolean {
  return /(overlay|watermark|badge|promo|sale-banner|sticker|label)/i.test(url);
}

function preferMerchantCompliantImages(urls: string[]): string[] {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  const clean = urls.filter((url) => !isOverlayLikeImageUrl(url));
  return clean.length > 0 ? clean : urls;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getLocalizedValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    return String(localized.pl || localized.en || localized.de || fallback);
  }

  return fallback;
}

function clampRating(value: number) {
  return Math.max(0, Math.min(5, value || 0));
}

function normalizeCurrency(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.toUpperCase() : 'PLN';
}

function parsePriceAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === 'string') {
    const cleaned = value
      .trim()
      .replace(/\s+/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

function getReturnPolicyText(raw: unknown): string {
  if (typeof raw === 'string') {
    return raw;
  }

  if (raw && typeof raw === 'object') {
    const value = raw as Record<string, unknown>;
    if (typeof value.conditions === 'string') {
      return value.conditions;
    }
    if (typeof value.days === 'number') {
      return `${value.days} dni`;
    }
  }

  return '';
}

function extractReturnWindowDays(policyText: string): number | undefined {
  const match = policyText.match(/(\d{1,3})\s*(dni|day|days)/i);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function buildMerchantReturnPolicy(policyText: string) {
  if (!policyText) {
    return undefined;
  }

  const normalized = policyText.toLowerCase();
  const returnDays = extractReturnWindowDays(policyText);
  if (normalized.includes('brak zwrot') || normalized.includes('nie podlega zwrotowi')) {
    return {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'PL',
      returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    };
  }

  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'PL',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    ...(returnDays && {
      merchantReturnDays: returnDays,
    }),
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: normalized.includes('darmow')
      ? 'https://schema.org/FreeReturn'
      : 'https://schema.org/ReturnShippingFees',
  };
}

function buildShippingDetails(input: {
  shippingCost?: number;
  freeShipping?: boolean;
  currency?: string;
}) {
  const hasCost = typeof input.shippingCost === 'number' && Number.isFinite(input.shippingCost);
  const isFreeShipping = input.freeShipping === true || (hasCost && (input.shippingCost || 0) <= 0);

  if (!hasCost && !isFreeShipping) {
    return undefined;
  }

  const shippingValue = isFreeShipping ? 0 : Math.max(0, input.shippingCost || 0);
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: shippingValue,
      currency: normalizeCurrency(input.currency),
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'PL',
    },
  };
}

/**
 * Generate Product schema.org JSON-LD for rich snippets
 * Supports both M6 (ProductCore + Deals) and legacy (Product) models
 */
export function generateProductJsonLd(
  productData: ProductCore | Product,
  isM6: boolean,
  deals: DealM6[] = [],
  productCore?: ProductCore,
  product?: Product
) {
  const productId = productData.id;
  
  // Extract name
  const productName = getLocalizedValue((productData as any).title, (productData as any).name || 'Produkt');
  
  // Extract description
  let productDescription = '';
  if (typeof (productData as any).description === 'string') {
    productDescription = (productData as any).description;
  } else if (typeof (productData as any).description === 'object') {
    productDescription = (productData as any).description.pl || (productData as any).description.en || '';
  }
  if (!productDescription && (productData as any).shortDescription) {
    productDescription = typeof (productData as any).shortDescription === 'string'
      ? (productData as any).shortDescription
      : (productData as any).shortDescription.pl || '';
  }
  
  // Get images
  const rawImages = isM6
    ? (productCore?.images || []).map(getValidAbsoluteUrl).filter((img): img is string => Boolean(img)).slice(0, 5)
    : ([getValidAbsoluteUrl(product?.image)].filter((img): img is string => Boolean(img)));
  const images = preferMerchantCompliantImages(rawImages);
  
  // Get prices
  const priceAmount = isM6 
    ? (productCore?.bestPrice?.amount ?? 0)
    : (product?.price ?? 0);
  const priceCurrency = isM6
    ? (productCore?.bestPrice?.currency ?? 'PLN')
    : 'PLN';
  
  // Get ratings
  const ratingValue = isM6
    ? (productCore?.rating?.score ?? 0)
    : (product?.ratingCard?.average ?? 0);
  const ratingCount = isM6
    ? (productCore?.rating?.count ?? 0)
    : (product?.ratingCard?.count ?? 0);
  
  // For M6: use deals for AggregateOffer
  const safeDeals = isM6
    ? (deals || []).filter(d => d?.price?.amount != null)
    : [];
  const lowestPrice = safeDeals.length > 0
    ? Math.min(...safeDeals.map(d => d.price?.amount || 0))
    : priceAmount;
  const highestPrice = safeDeals.length > 0
    ? Math.max(...safeDeals.map(d => d.price?.amount || 0))
    : priceAmount;
  
  const baseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${PRODUCT_BASE_URL}/${productId}`,
    url: `${PRODUCT_BASE_URL}/${productId}`,
    name: productName,
    description: productDescription.slice(0, 500),
    image: images,
    sku: productId,
    brand: {
      '@type': 'Brand',
      name: isM6 ? 'Various' : (product?.metadata?.brand || 'Various'),
    },
    aggregateRating:
      ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: Math.max(0, Math.min(5, ratingValue || 0)),
            reviewCount: ratingCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
  };

  // Add offers based on model
  if (isM6 && safeDeals.length > 0) {
    // M6: AggregateOffer with individual offers
    return {
      ...baseSchema,
      offers: {
        '@type': 'AggregateOffer',
        url: `${PRODUCT_BASE_URL}/${productId}`,
        priceCurrency,
        lowPrice: lowestPrice,
        highPrice: highestPrice,
        offerCount: safeDeals.length,
        availability: 'https://schema.org/InStock',
        offers: safeDeals.slice(0, 10).map((deal) => ({
          '@type': 'Offer',
          url: deal?.id ? `${DEAL_BASE_URL}/${deal.id}` : `${PRODUCT_BASE_URL}/${productId}`,
          price: deal.price?.amount || 0,
          priceCurrency: normalizeCurrency(deal.price?.currency || priceCurrency),
            availability:
              deal.stockStatus === 'in_stock' ||
              deal.stockStatus === 'low_stock' ||
              deal.isActive === true
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
          shippingDetails: buildShippingDetails({
            shippingCost: deal?.shipping?.cost,
            freeShipping: (deal?.shipping?.cost || 0) <= 0,
            currency: deal?.price?.currency || priceCurrency,
          }),
          seller: {
            '@type': 'Organization',
            name: deal.merchantName || deal.source || 'Unknown Seller',
          },
          priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        })),
      },
    };
  } else {
    // Legacy: Single Offer
    return {
      ...baseSchema,
      offers: {
        '@type': 'Offer',
        url: `${PRODUCT_BASE_URL}/${productId}`,
        price: priceAmount || 0,
        priceCurrency: normalizeCurrency(priceCurrency),
        availability:
          product?.metadata?.stockStatus === 'in_stock'
            ? 'https://schema.org/InStock'
            : product?.metadata?.stockStatus === 'low_stock'
              ? 'https://schema.org/LimitedAvailability'
              : 'https://schema.org/OutOfStock',
        shippingDetails: buildShippingDetails({
          shippingCost: (product as any)?.shippingCost ?? (product as any)?.price?.shippingCost,
          freeShipping: (product as any)?.freeShipping ?? (product as any)?.price?.freeShipping,
          currency: priceCurrency,
        }),
        hasMerchantReturnPolicy: buildMerchantReturnPolicy(getReturnPolicyText((product as any)?.returnPolicy || product?.metadata?.returnPolicy)),
        seller: {
          '@type': 'Organization',
          name: product?.metadata?.merchant || 'Various',
        },
        ...(product?.originalPrice && {
          priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        }),
      },
    };
  }
}

/**
 * Generate BreadcrumbList schema.org JSON-LD
 */
export function generateBreadcrumbJsonLd(
  productName: string,
  productId: string,
  category?: string | { name: string; path: string },
  entityType: 'products' | 'deals' = 'products'
) {
  const collectionLabel = entityType === 'products' ? 'Produkty' : 'Okazje';
  const collectionUrl = entityType === 'products' ? `${BASE_URL}/pl/products` : `${BASE_URL}/pl/deals`;
  const entityUrl = entityType === 'products' ? `${PRODUCT_BASE_URL}/${productId}` : `${DEAL_BASE_URL}/${productId}`;
  
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Okazje Plus',
      item: BASE_URL,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: collectionLabel,
      item: collectionUrl,
    },
  ];

  if (category) {
    const categoryName = typeof category === 'string' ? category : category.name;
    const categoryPath = typeof category === 'string' ? `${BASE_URL}/pl/categories/${category}` : `${BASE_URL}${category.path}`;
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: categoryName,
      item: categoryPath,
    });
  }

  items.push({
    '@type': 'ListItem',
    position: items.length + 1,
    name: productName,
    item: entityUrl,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/**
 * Generate Offer schema.org JSON-LD for deal detail pages
 */
export function generateDealJsonLd(deal: Deal) {
  const dealTitle = getLocalizedValue(deal.title, 'Okazja');
  const dealDescription = stripHtml(getLocalizedValue(deal.description, ''));
  const price = typeof deal.price === 'object'
    ? parsePriceAmount(deal.price.amount)
    : parsePriceAmount(deal.price);
  const priceCurrency = typeof deal.price === 'object' && typeof deal.price.currency === 'string'
    ? deal.price.currency.toUpperCase()
    : 'PLN';
  const sellerName = deal.merchant || 'Various';
  const dealUrl = `${DEAL_BASE_URL}/${deal.id}`;
  const dealImage = preferMerchantCompliantImages(
    [getValidAbsoluteUrl(deal.image)].filter((img): img is string => Boolean(img))
  )[0];
  const returnPolicy =
    getReturnPolicyText((deal as any)?.returnPolicy)
    || getReturnPolicyText((deal as any)?.metadata?.returnPolicy)
    || getReturnPolicyText((deal as any)?.importMetadata?.returnPolicy);

  const offerNode = {
    '@type': 'Offer',
    url: dealUrl,
    priceCurrency: normalizeCurrency(priceCurrency),
    price,
    availability: deal.stockAlert === 'ending-soon'
      ? 'https://schema.org/LimitedAvailability'
      : 'https://schema.org/InStock',
    ...(deal.expiryDate && {
      priceValidUntil: deal.expiryDate,
    }),
    shippingDetails: buildShippingDetails({
      shippingCost: deal.shippingCost,
      freeShipping: deal.freeShipping,
      currency: priceCurrency,
    }),
    hasMerchantReturnPolicy: buildMerchantReturnPolicy(returnPolicy),
    seller: {
      '@type': 'Organization',
      name: sellerName,
    },
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: dealTitle,
    description: dealDescription,
    ...(dealImage && { image: dealImage }),
    url: dealUrl,
    offers: offerNode,
    ...(deal.originalPrice && {
      priceSpecification: {
        '@type': 'PriceSpecification',
        price,
        priceCurrency,
        valueAddedTaxIncluded: true,
      },
    }),
    ...(deal.merchant && {
      brand: {
        '@type': 'Brand',
        name: deal.merchant,
      },
    }),
  };
}

/**
 * Generate homepage CollectionPage + ItemList structured data
 */
export function generateHomePageJsonLd(
  hotDeals: Deal[] = [],
  topProducts: Product[] = []
) {
  const homeUrl = `${BASE_URL}/pl`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${homeUrl}#collection-page`,
        url: homeUrl,
        name: 'Okazje Plus - Najlepsze promocje i produkty w jednym miejscu',
        description: 'Odkryj najgorętsze okazje i promocje oraz najlepiej oceniane produkty w Okazje Plus.',
        inLanguage: 'pl-PL',
        mainEntity: [
          { '@id': `${homeUrl}#hot-deals` },
          { '@id': `${homeUrl}#top-products` },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${homeUrl}#hot-deals`,
        name: 'Najgorętsze okazje',
        url: `${homeUrl}#najgoretsze-okazje`,
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        numberOfItems: hotDeals.length,
        itemListElement: hotDeals.slice(0, 8).map((deal, index) => {
          const dealTitle = getLocalizedValue(deal.title, 'Okazja');
          const dealPrice = typeof deal.price === 'object' ? Number(deal.price.amount) || 0 : Number(deal.price) || 0;
          const dealCurrency = typeof deal.price === 'object' && typeof deal.price.currency === 'string'
            ? deal.price.currency.toUpperCase()
            : 'PLN';
          const dealUrl = `${DEAL_BASE_URL}/${deal.id}`;
          const dealImage = preferMerchantCompliantImages(
            [getValidAbsoluteUrl(deal.image)].filter((img): img is string => Boolean(img))
          )[0];

          return {
            '@type': 'ListItem',
            position: index + 1,
            url: dealUrl,
            item: {
              '@type': 'Offer',
              name: dealTitle,
              url: dealUrl,
              ...(dealImage && { image: dealImage }),
              price: dealPrice,
              priceCurrency: dealCurrency,
              availability: 'https://schema.org/InStock',
            },
          };
        }),
      },
      {
        '@type': 'ItemList',
        '@id': `${homeUrl}#top-products`,
        name: 'Najlepiej oceniane produkty',
        url: `${homeUrl}#najlepiej-oceniane-produkty`,
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        numberOfItems: topProducts.length,
        itemListElement: topProducts.slice(0, 8).map((product, index) => {
          const productTitle = getLocalizedValue((product as any).title, (product as any).name || 'Produkt');
          const productDescription = getLocalizedValue((product as any).shortDescription, getLocalizedValue((product as any).description, ''));
          const legacyPrice = typeof (product as any).price === 'object'
            ? Number((product as any).price.amount) || 0
            : Number((product as any).price) || 0;
          const m6BestPrice = Number((product as any)?.bestPrice?.amount) || 0;
          const productPrice = m6BestPrice > 0 ? m6BestPrice : legacyPrice;
          const productCurrency = String((product as any)?.bestPrice?.currency || 'PLN').toUpperCase();
          const productImage = preferMerchantCompliantImages([
            getValidAbsoluteUrl((product as any).image),
            getValidAbsoluteUrl((product as any).imageUrl),
            getValidAbsoluteUrl((product as any).images?.[0]),
          ].filter((img): img is string => Boolean(img)))[0];
          const ratingValue = clampRating(Number((product as any)?.ratingCard?.average) || Number((product as any)?.rating?.score) || 0);
          const ratingCount = Number((product as any)?.ratingCard?.count) || Number((product as any)?.rating?.count) || 0;

          return {
            '@type': 'ListItem',
            position: index + 1,
            url: `${PRODUCT_BASE_URL}/${product.id}`,
            item: {
              '@type': 'Product',
              name: productTitle,
              url: `${PRODUCT_BASE_URL}/${product.id}`,
              ...(productImage && { image: productImage }),
              description: productDescription.slice(0, 300),
              ...(productPrice > 0 && {
                offers: {
                  '@type': 'Offer',
                  price: productPrice,
                  priceCurrency: productCurrency,
                  availability: 'https://schema.org/InStock',
                },
              }),
              ...(ratingCount > 0 && {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue,
                  reviewCount: ratingCount,
                  bestRating: 5,
                  worstRating: 1,
                },
              }),
            },
          };
        }),
      },
    ],
  };
}

/**
 * Generate FAQPage schema for product FAQs
 */
export function generateFaqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate WebSite schema for site-wide markup
 */
export function generateWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Okazje+',
    alternateName: 'OkazjePlus',
    url: BASE_URL,
    description: 'Najlepsze okazje zakupowe, promocje i wyprzedaże w Polsce. Społeczność dzieląca się najgorętszymi ofertami i cenami produktów.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate Organization schema for site-wide markup
 */
export function generateOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Okazje+',
    url: BASE_URL,
    logo: `${BASE_URL}/Logotyp_okazjePlus.png`,
    description: 'Najlepsze okazje zakupowe, promocje i wyprzedaże w Polsce. Społeczność łowców okazji wspierana przez AI.',
    sameAs: [
      'https://www.facebook.com/people/Okazje-Plus/61583646609859',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Polish', 'English', 'German'],
    },
  };
}

/**
 * Generate VideoObject schema for dedicated watch pages.
 */
export function generateVideoObjectJsonLd(input: {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  watchPath: string;
  uploadDate: string;
}) {
  const safeUploadDate = input.uploadDate || new Date().toISOString();
  const watchUrl = `${BASE_URL}${input.watchPath}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    '@id': `${watchUrl}#video`,
    name: input.name,
    description: input.description,
    thumbnailUrl: [input.thumbnailUrl],
    uploadDate: safeUploadDate,
    contentUrl: input.contentUrl,
    url: watchUrl,
    publisher: {
      '@type': 'Organization',
      name: 'Okazje+',
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/Logotyp_okazjePlus.png`,
      },
    },
  };
}

/**
 * Generate BreadcrumbList JSON-LD for category hierarchy pages.
 * Supports up to 3 levels: main → sub → subSub.
 *
 * @param locale - active locale, used for canonical path construction
 * @param mainSlug - top-level category slug
 * @param mainName - display name for main category
 * @param subSlug - optional sub-category slug
 * @param subName  - optional sub-category display name
 * @param subSubSlug - optional sub-sub slug
 * @param subSubName - optional sub-sub display name
 */
export function generateCategoryBreadcrumbJsonLd(opts: {
  locale: string;
  mainSlug: string;
  mainName: string;
  subSlug?: string;
  subName?: string;
  subSubSlug?: string;
  subSubName?: string;
}) {
  const { locale, mainSlug, mainName, subSlug, subName, subSubSlug, subSubName } = opts;

  const items: Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> = [
    { '@type': 'ListItem', position: 1, name: 'Strona Główna', item: BASE_URL },
    {
      '@type': 'ListItem',
      position: 2,
      name: mainName,
      item: `${BASE_URL}/${locale}/categories/${encodeURIComponent(mainSlug)}`,
    },
  ];

  if (subSlug && subName) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: subName,
      item: `${BASE_URL}/${locale}/categories/${encodeURIComponent(mainSlug)}/${encodeURIComponent(subSlug)}`,
    });
  }

  if (subSubSlug && subSubName) {
    items.push({
      '@type': 'ListItem',
      position: 4,
      name: subSubName,
      item: `${BASE_URL}/${locale}/categories/${encodeURIComponent(mainSlug)}/${encodeURIComponent(subSlug!)}/${encodeURIComponent(subSubSlug)}`,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

