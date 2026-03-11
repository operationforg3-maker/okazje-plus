import { ProductCore, DealM6, Product, Deal } from '@/lib/types';

const BASE_URL = 'https://okazjeplus.pl';
const PRODUCT_BASE_URL = `${BASE_URL}/pl/products`;
const DEAL_BASE_URL = `${BASE_URL}/pl/deals`;

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
  const images = isM6
    ? ((productCore?.images || []).slice(0, 5))
    : ([product?.image].filter(Boolean));
  
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
          url: `${PRODUCT_BASE_URL}/${productId}`,
          price: deal.price?.amount || 0,
          priceCurrency: deal.price?.currency || priceCurrency,
          availability: (deal as any)?.inStock === true || (deal as any)?.availability === 'in_stock'
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: deal.source || 'Unknown Seller',
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
        priceCurrency,
        availability:
          product?.metadata?.stockStatus === 'in_stock'
            ? 'https://schema.org/InStock'
            : product?.metadata?.stockStatus === 'low_stock'
              ? 'https://schema.org/LimitedAvailability'
              : 'https://schema.org/OutOfStock',
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
  categoryName?: string,
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

  if (categoryName) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: categoryName,
      item: `${BASE_URL}/pl/categories/${categoryName}`,
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
  const dealDescription = getLocalizedValue(deal.description, '');
  const price = typeof deal.price === 'object' ? Number(deal.price.amount) || 0 : Number(deal.price) || 0;
  const priceCurrency = typeof deal.price === 'object' && typeof deal.price.currency === 'string'
    ? deal.price.currency.toUpperCase()
    : 'PLN';
  const sellerName = deal.merchant || 'Various';

  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: dealTitle,
    description: dealDescription,
    image: deal.image,
    url: `${DEAL_BASE_URL}/${deal.id}`,
    priceCurrency,
    price,
    ...(deal.originalPrice && {
      priceSpecification: {
        '@type': 'PriceSpecification',
        price,
        priceCurrency,
        valueAddedTaxIncluded: true,
      },
    }),
    ...(deal.expiryDate && {
      priceValidUntil: deal.expiryDate,
    }),
    availability: deal.stockAlert === 'ending-soon'
      ? 'https://schema.org/LimitedAvailability'
      : 'https://schema.org/InStock',
    seller: {
      '@type': 'Organization',
      name: sellerName,
    },
    ...(deal.merchant && {
      brand: {
        '@type': 'Brand',
        name: deal.merchant,
      },
    }),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: clampRating((deal.temperature || 0) / 100),
      reviewCount: deal.voteCount || 0,
      bestRating: 5,
      worstRating: 1,
    },
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

          return {
            '@type': 'ListItem',
            position: index + 1,
            url: `${DEAL_BASE_URL}/${deal.id}`,
            item: {
              '@type': 'Offer',
              name: dealTitle,
              url: `${DEAL_BASE_URL}/${deal.id}`,
              image: deal.image,
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
          const productPrice = typeof (product as any).price === 'object'
            ? Number((product as any).price.amount) || 0
            : Number((product as any).price) || 0;
          const productImage = (product as any).image || (product as any).imageUrl || (product as any).images?.[0];
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
              image: productImage,
              description: productDescription.slice(0, 300),
              ...(productPrice > 0 && {
                offers: {
                  '@type': 'Offer',
                  price: productPrice,
                  priceCurrency: 'PLN',
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
