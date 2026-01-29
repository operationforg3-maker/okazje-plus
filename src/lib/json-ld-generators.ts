import { ProductCore, DealM6, Product } from '@/lib/types';

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
  const baseUrl = 'https://okazjeplus.pl/pl/products';
  
  // Extract name
  const productName = typeof (productData as any).title === 'object'
    ? (productData as any).title.pl || (productData as any).title.en || 'Produkt'
    : (productData as any).title || (productData as any).name || 'Produkt';
  
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
    '@id': `${baseUrl}/${productId}`,
    url: `${baseUrl}/${productId}`,
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
        url: `${baseUrl}/${productId}`,
        priceCurrency,
        lowPrice: lowestPrice,
        highPrice: highestPrice,
        offerCount: safeDeals.length,
        availability: 'https://schema.org/InStock',
        offers: safeDeals.slice(0, 10).map((deal) => ({
          '@type': 'Offer',
          url: `${baseUrl}/${productId}`,
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
        url: `${baseUrl}/${productId}`,
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
  categoryName?: string
) {
  const baseUrl = 'https://okazjeplus.pl';
  
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Okazje Plus',
      item: baseUrl,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Produkty',
      item: `${baseUrl}/pl/products`,
    },
  ];

  if (categoryName) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: categoryName,
      item: `${baseUrl}/pl/categories/${categoryName}`,
    });
  }

  items.push({
    '@type': 'ListItem',
    position: items.length + 1,
    name: productName,
    item: `${baseUrl}/pl/products/${productId}`,
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
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
 * Generate Organization schema for site-wide markup
 */
export function generateOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Okazje Plus',
    url: 'https://okazjeplus.pl',
    logo: 'https://okazjeplus.pl/logo.png',
    description: 'Platforma porównywania cen i okazji opartą na sztucznej inteligencji',
    sameAs: [
      'https://www.facebook.com/okazjeplus',
      'https://twitter.com/okazjeplus',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      email: 'support@okazjeplus.pl',
    },
  };
}
