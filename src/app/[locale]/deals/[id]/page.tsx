import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Deal, LocalizedText } from '@/lib/types';
import { getDealById, getDealsForProduct, getHotDeals, getProductCore } from '@/lib/data';
import DealDetailClient from './deal-detail-client';

// Force dynamic rendering dla real-time danych
export const dynamic = 'force-dynamic';
export const revalidate = 300; // ISR: revalidate co 5 minut

interface PageProps {
  params: { id: string; locale: string };
}

// Normalizacja M6 → legacy Deal (UI wymaga legacy pól)
function ensureLocalizedText(value: any, fallback: string): LocalizedText {
  if (typeof value === 'string') {
    return { pl: value, en: value, de: value };
  }
  if (value && typeof value === 'object') {
    return {
      pl: value.pl || value.en || value.de || fallback,
      en: value.en || value.pl || value.de || fallback,
      de: value.de || value.pl || value.en || fallback,
    };
  }
  return { pl: fallback, en: fallback, de: fallback };
}

function normalizeDealForUi(raw: any, product?: any | null): Deal | null {
  const priceAmount = typeof raw?.price === 'number' ? raw.price : raw?.price?.amount ?? raw?.priceV2?.amount ?? 0;
  const image = raw?.image || product?.images?.[0];
  if (!image) return null;

  const title = ensureLocalizedText(raw?.title, product?.title?.pl || 'Okazja');
  const description = ensureLocalizedText(raw?.description, product?.shortDescription?.pl || '');
  const link = raw?.link || raw?.affiliateLink || raw?.sourceUrl || '';
  const mainCategorySlug = raw?.mainCategorySlug || product?.mainCategorySlug || 'inne';
  const subCategorySlug = raw?.subCategorySlug || product?.subCategorySlug || 'inne';

  return {
    id: raw?.id,
    title,
    description,
    price: priceAmount,
    originalPrice: typeof raw?.originalPrice === 'number' ? raw.originalPrice : priceAmount,
    link,
    image,
    imageHint: raw?.imageHint || image,
    postedBy: raw?.postedBy || 'system',
    postedAt: raw?.postedAt || raw?.createdAt || new Date().toISOString(),
    voteCount: raw?.voteCount ?? 0,
    temperature: raw?.temperature ?? 0,
    commentsCount: raw?.commentsCount ?? 0,
    shareCount: raw?.shareCount,
    category: raw?.category || mainCategorySlug,
    mainCategorySlug,
    subCategorySlug,
    subSubCategorySlug: raw?.subSubCategorySlug || product?.subSubCategorySlug,
    merchant: raw?.merchant || raw?.merchantName,
    shippingCost: raw?.shippingCost ?? raw?.shipping?.cost ?? 0,
    status: raw?.status || 'approved',
    createdBy: raw?.createdBy,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
    linkedProductIds: raw?.linkedProductIds || (product?.id ? [product.id] : []),
    externalOriginalId: raw?.externalOriginalId || raw?.sourceProductId,
    source: raw?.source || 'manual',
    dealType: raw?.dealType,
    couponCode: raw?.couponCode,
    freeShipping: raw?.freeShipping ?? (raw?.shipping?.cost === 0 ? true : undefined),
    cashback: raw?.cashback,
    minOrderValue: raw?.minOrderValue,
    stockAlert: raw?.stockAlert,
    expiryDate: raw?.expiryDate,
    availableQuantity: raw?.availableQuantity,
    limitPerUser: raw?.limitPerUser,
    requiresMembership: raw?.requiresMembership,
    conditions: raw?.conditions || [],
    gallery: raw?.gallery || product?.images || [image],
    verified: raw?.verified,
    verifiedAt: raw?.verifiedAt,
    verifiedBy: raw?.verifiedBy,
    tags: raw?.tags || product?.searchTags || [],
    aiQuality: raw?.aiQuality,
    importMetadata: raw?.importMetadata,
    metadata: raw?.metadata,
  } satisfies Deal;
}

// Server-side data fetching
async function getDealData(id: string) {
  const dealDoc = await getDealById(id);
  if (!dealDoc || (dealDoc as any).status && (dealDoc as any).status !== 'approved') {
    return null;
  }

  const productId = (dealDoc as any).productId || (dealDoc as any).linkedProductIds?.[0];
  const product = productId ? await getProductCore(productId) : null;
  const deal = normalizeDealForUi(dealDoc, product);
  if (!deal) return null;

  let relatedDeals: Deal[] = [];
  if (productId) {
    const relatedDocs = await getDealsForProduct(productId);
    relatedDeals = relatedDocs
      .filter(d => d.id !== id)
      .map(d => normalizeDealForUi(d as any, product))
      .filter(Boolean) as Deal[];
  }

  return { deal, relatedDeals };
}

// SEO: Generate metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getDealData(params.id);
  
  if (!data) {
    return {
      title: 'Okazja nie znaleziona',
      description: 'Szukana okazja nie istnieje w naszej bazie.',
    };
  }
  
  const { deal } = data;
  const dealTitle = typeof deal.title === 'string' ? deal.title : deal.title?.pl || deal.title?.en || 'Okazja';
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.price);
  const originalPrice = deal.originalPrice 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice)
    : null;
  const discount = deal.originalPrice && deal.originalPrice > 0
    ? Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)
    : null;
  
  const metaTitle = `${dealTitle} - ${price}${discount ? ` (-${discount}%)` : ''} | Okazje Plus`;
  const dealDescription = typeof deal.description === 'string' ? deal.description : deal.description?.pl || deal.description?.en || '';
  const metaDescription = `${dealDescription.slice(0, 120)}... Temperatura: ${deal.temperature ?? 0}°, ${(deal.voteCount ?? 0)} głosów. ${originalPrice ? `Cena przed obniżką: ${originalPrice}.` : ''}`;
  
  const keywords = [
    deal.mainCategorySlug,
    deal.subCategorySlug,
    deal.subSubCategorySlug || '',
    deal.merchant || '',
    'okazja',
    'promocja',
    discount && discount > 50 ? 'mega promocja' : '',
    deal.freeShipping ? 'darmowa dostawa' : '',
    ...(deal.tags || []),
  ].filter(Boolean);
  
  const canonicalUrl = `https://okazje.plus/pl/deals/${deal.id}`;
  
  return {
    title: metaTitle,
    description: metaDescription,
    keywords: keywords.join(', '),
    authors: [{ name: deal.postedBy || 'Społeczność Okazje Plus' }],
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: canonicalUrl,
      siteName: 'Okazje Plus',
      locale: 'pl_PL',
      type: 'website',
      images: [
        {
          url: deal.image,
          width: 1200,
          height: 630,
          alt: dealTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDescription,
      images: [deal.image],
    },
    alternates: {
      canonical: canonicalUrl,
    },
    other: {
      'product:price:amount': deal.price.toString(),
      'product:price:currency': 'PLN',
      ...(originalPrice && { 'product:original_price:amount': deal.originalPrice?.toString() }),
      'deal:temperature': deal.temperature.toString(),
      'deal:votes': deal.voteCount.toString(),
    },
  };
}

// Optional: Generate static params for hot deals
export async function generateStaticParams() {
  try {
    const deals = await getHotDeals(100);
    return deals.map(deal => ({ id: deal.id }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

export default async function DealDetailPage({ params }: PageProps) {
  const data = await getDealData(params.id);
  
  if (!data) {
    notFound();
  }
  
  const { deal, relatedDeals } = data;
  
  // JSON-LD structured data dla Google Rich Results
  const dealTitle = typeof deal.title === 'string' ? deal.title : deal.title?.pl || 'Okazja';
  const dealDescription = typeof deal.description === 'string' ? deal.description : deal.description?.pl || '';
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: dealTitle,
    description: dealDescription,
    image: deal.image,
    url: `https://okazje.plus/pl/deals/${deal.id}`,
    priceCurrency: 'PLN',
    price: deal.price,
    ...(deal.originalPrice && {
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: deal.price,
        priceCurrency: 'PLN',
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
      name: deal.merchant || 'Various',
    },
    ...(deal.merchant && {
      brand: {
        '@type': 'Brand',
        name: deal.merchant,
      },
    }),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: Math.min(5, Math.max(1, deal.temperature / 100)),
      reviewCount: deal.voteCount,
      bestRating: 5,
      worstRating: 1,
    },
  };

  // BreadcrumbList schema for better navigation in Google
  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Strona główna',
        item: 'https://okazjeplus.pl'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Okazje',
        item: 'https://okazjeplus.pl/deals'
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: dealTitle,
        item: `https://okazjeplus.pl/deals/${deal.id}`
      }
    ]
  };
  
  return (
    <>
      {/* JSON-LD dla SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbList) }}
      />
      
      {/* Client component z interaktywnym UI */}
      <DealDetailClient 
        deal={deal}
        relatedDeals={relatedDeals}
      />
    </>
  );
}
