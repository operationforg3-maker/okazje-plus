import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Deal, LocalizedText } from '@/lib/types';
import { getProductCore } from '@/lib/data';
import { getExternalUrl } from '@/lib/external-url';
import { getDealById, searchDeals } from '@/lib/search-server';
import { generateDealJsonLd, generateBreadcrumbJsonLd } from '@/lib/json-ld-generators';
import { buildCategoryPath, humanizeCategorySlug } from '@/lib/category-routes';
import DealDetailClient from './deal-detail-client';

// ISR: revalidate co 5 minut — pozwala Next.js cache'ować strony i serwować stale-while-revalidate.
// NIE używamy force-dynamic — konfliktuje z revalidate i powoduje 5xx pod obciążeniem crawlera.
export const revalidate = 300;

interface PageProps {
  params: { id: string; locale: string };
}

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

function localeToOgLocale(locale: string): string {
  const map: Record<string, string> = {
    pl: 'pl_PL',
    en: 'en_US',
    de: 'de_DE',
    fr: 'fr_FR',
    es: 'es_ES',
    uk: 'uk_UA',
  };
  return map[locale] || 'pl_PL';
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
  // Helper to convert Firestore timestamps to ISO strings
  const toIsoString = (value: any) => {
    if (!value) return value;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (value.toDate && typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }
    if (value.seconds) {
      return new Date(value.seconds * 1000).toISOString();
    }
    return value;
  };

  const rawPriceObject = (raw?.price && typeof raw.price === 'object')
    ? raw.price
    : (raw?.priceV2 && typeof raw.priceV2 === 'object' ? raw.priceV2 : null);
  const priceAmount = typeof raw?.totalPrice === 'number'
    ? raw.totalPrice
    : (typeof raw?.price === 'number' ? raw.price : rawPriceObject?.amount ?? 0);
  const priceCurrency = typeof rawPriceObject?.currency === 'string'
    ? rawPriceObject.currency.toUpperCase()
    : 'PLN';
  const image = (raw?.image && raw.image !== '/icon_okazjeplus.svg') ? raw.image : (product?.images?.[0] || product?.imageUrl || '/icon_okazjeplus.svg');
  if (!image) return null;

  const title = ensureLocalizedText(raw?.title, product?.title?.pl || 'Okazja');
  
  // M6: Prioritize ProductCore full HTML description if available, fallback to deal description
  let descriptionInput = product?.fullDescription || product?.description || raw?.description;
  
  // Logic to ensure we have a valid LocalizedText
  const description = (descriptionInput && typeof descriptionInput === 'object' && descriptionInput.pl)
    ? descriptionInput as LocalizedText
    : ensureLocalizedText(descriptionInput, product?.shortDescription?.pl || '');

  const link = getExternalUrl(
    raw?.link,
    raw?.affiliateLink,
    raw?.affiliateUrl,
    raw?.dealUrl,
    raw?.sourceUrl,
    raw?.url,
    raw?.externalUrl,
    raw?.metadata?.offerPreviewUrl,
    raw?.metadata?.previewUrl,
    raw?.metadata?.offerUrl,
    raw?.metadata?.externalUrl,
    raw?.metadata?.url,
    raw?.product?.affiliateLink,
    raw?.product?.sourceUrl,
    product?.sourceLinks?.[0]?.url
  ) || '';
  const mainCategorySlug = raw?.mainCategorySlug || product?.mainCategorySlug || 'inne';
  const subCategorySlug = raw?.subCategorySlug || product?.subCategorySlug || 'inne';

  return {
    id: raw?.id,
    title,
    description,
    price: { amount: priceAmount, currency: priceCurrency },
    originalPrice: typeof raw?.originalPrice === 'number' ? raw.originalPrice : priceAmount,
    link,
    image,
    imageHint: raw?.imageHint || image,
    postedBy: raw?.postedBy || 'system',
    postedAt: toIsoString(raw?.postedAt) || toIsoString(raw?.createdAt) || new Date().toISOString(),
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
    createdAt: toIsoString(raw?.createdAt),
    updatedAt: toIsoString(raw?.updatedAt),
    linkedProductIds: raw?.linkedProductIds || (product?.id ? [product.id] : []),
    externalOriginalId: raw?.externalOriginalId || raw?.sourceProductId,
    source: raw?.source || 'manual',
    dealType: raw?.dealType,
    couponCode: raw?.couponCode,
    freeShipping: raw?.freeShipping ?? (raw?.shipping?.cost === 0 ? true : undefined),
    cashback: raw?.cashback,
    minOrderValue: raw?.minOrderValue,
    stockAlert: raw?.stockAlert,
    expiryDate: toIsoString(raw?.expiryDate),
    availableQuantity: raw?.availableQuantity,
    limitPerUser: raw?.limitPerUser,
    requiresMembership: raw?.requiresMembership,
    conditions: raw?.conditions || [],
    gallery: raw?.gallery || product?.images || [image],
    verified: raw?.verified,
    verifiedAt: toIsoString(raw?.verifiedAt),
    verifiedBy: raw?.verifiedBy,
    tags: raw?.tags || product?.searchTags || [],
    aiQuality: raw?.aiQuality,
    importMetadata: raw?.importMetadata,
    metadata: raw?.metadata,
  } satisfies Deal;
}

// Server-side data fetching
type DealDataResult =
  | { gone: true }
  | { gone?: false; expired?: boolean; deal: Deal; relatedDeals: Deal[]; product: any };

async function getDealData(id: string): Promise<DealDataResult | null> {
  const dealDoc = await getDealById(id);
  
  // Deal document doesn't exist at all — true 404
  if (!dealDoc) {
    return null;
  }

  // Block only truly hidden statuses (drafts / rejected).
  // These existed once but are now gone — return 410 signal.
  const hiddenDealStatuses = ['draft', 'rejected'];
  if (hiddenDealStatuses.includes((dealDoc as any).status)) {
    return { gone: true };
  }

  const productId =
    (dealDoc as any).productCoreId ||
    (dealDoc as any).productId ||
    (dealDoc as any).linkedProductIds?.[0];
  const product = productId ? await getProductCore(productId) : null;
  const deal = normalizeDealForUi(dealDoc, product);
  if (!deal) return null;

  let relatedDeals: Deal[] = [];

  if (relatedDeals.length === 0) {
    const hotDeals = await searchDeals('*', {
      limit: 60,
      sortBy: 'hot',
      statusFilter: 'approved',
    });
    relatedDeals = hotDeals
      .filter((d) => d.id !== id)
      .filter((d) => {
        if (deal.subSubCategorySlug && d.subSubCategorySlug) {
          return d.subSubCategorySlug === deal.subSubCategorySlug;
        }
        if (deal.subCategorySlug && d.subCategorySlug) {
          return d.subCategorySlug === deal.subCategorySlug;
        }
        return d.mainCategorySlug === deal.mainCategorySlug;
      })
      .map((d) => normalizeDealForUi(d as any, product))
      .filter(Boolean)
      .slice(0, 6) as Deal[];
  }

  const isExpired = (dealDoc as any).status === 'expired' || 
                    (dealDoc as any).lifecycleStatus === 'expired' || 
                    deal.isActive === false;

  return { deal, relatedDeals, product, expired: isExpired };
}

// SEO: Generate metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const locale = SUPPORTED_LOCALES.includes(resolvedParams.locale as (typeof SUPPORTED_LOCALES)[number])
    ? resolvedParams.locale
    : 'pl';
  const data = await getDealData(resolvedParams.id);
  
  // 410 Gone — deal exists in DB but is rejected/deleted
  if (data && 'gone' in data && data.gone) {
    return {
      title: 'Okazja usunięta | Okazje Plus',
      description: 'Ta okazja została usunięta i nie jest już dostępna.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  if (!data || ('gone' in data && data.gone)) {
    return {
      title: 'Okazja nie znaleziona | Okazje Plus',
      description: 'Szukana okazja nie istnieje w naszej bazie.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  if (data.expired) {
    return {
      title: `[WYGASŁA] ${(data.deal.title as any)?.pl || 'Okazja'} | Okazje Plus`,
      description: 'Ta okazja wygasła i nie jest już dostępna.',
      robots: {
        index: false,
        follow: true,
      },
    };
  }
  
  const { deal } = data;
  const dealTitle = typeof deal.title === 'string' ? deal.title : deal.title?.pl || deal.title?.en || 'Okazja';
  
  const getPriceMeta = (priceValue: any) => {
    if (priceValue && typeof priceValue === 'object') {
      return {
        amount: Number(priceValue.amount) || 0,
        currency: typeof priceValue.currency === 'string' ? priceValue.currency.toUpperCase() : 'PLN',
      };
    }
    return { amount: Number(priceValue) || 0, currency: 'PLN' };
  };

  const priceMeta = getPriceMeta(deal.price);
  const pVal = priceMeta.amount;
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: priceMeta.currency }).format(pVal);
  const originalPrice = deal.originalPrice 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: priceMeta.currency }).format(deal.originalPrice)
    : null;
  const discount = deal.originalPrice && deal.originalPrice > 0
    ? Math.round(((deal.originalPrice - pVal) / deal.originalPrice) * 100)
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
  
  const canonicalUrl = `https://okazjeplus.pl/${locale}/deals/${deal.id}`;
  
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
      locale: localeToOgLocale(locale),
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
      languages: Object.fromEntries(
        [
          ...SUPPORTED_LOCALES.map((localeCode) => [localeCode, `https://okazjeplus.pl/${localeCode}/deals/${deal.id}`]),
          ['x-default', `https://okazjeplus.pl/pl/deals/${deal.id}`],
        ]
      ),
    },
    other: {
      'product:price:amount': String(pVal),
      'product:price:currency': priceMeta.currency,
      ...(originalPrice && { 'product:original_price:amount': deal.originalPrice?.toString() }),
      'deal:temperature': deal.temperature.toString(),
      'deal:votes': deal.voteCount.toString(),
    },
  };
}

// Optional: Generate static params for hot deals
export async function generateStaticParams() {
  try {
    const deals = await searchDeals('*', {
      limit: 100,
      sortBy: 'hot',
      statusFilter: 'approved',
    });
    return deals.map(deal => ({ id: deal.id }));
  } catch (error) {
    console.error('Error generating static params:', error);
    return [];
  }
}

/** Deep-sanitize any value so Next.js can serialize it across the Server→Client boundary.
 *  Firestore Admin SDK can return objects with custom prototypes (Timestamp, DocumentReference, etc.)
 *  that Next.js refuses to pass to Client Components. JSON round-trip removes all non-plain objects. */
function deepSerialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(
      JSON.stringify(value, (_, v) => {
        // Convert Firestore Timestamp-like objects to ISO string
        if (v && typeof v === 'object' && typeof v.toDate === 'function') {
          return v.toDate().toISOString();
        }
        if (v && typeof v === 'object' && v.seconds !== undefined && v.nanoseconds !== undefined) {
          return new Date(v.seconds * 1000).toISOString();
        }
        return v;
      })
    );
  } catch {
    return value;
  }
}

export default async function DealDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const locale = SUPPORTED_LOCALES.includes(resolvedParams.locale as (typeof SUPPORTED_LOCALES)[number])
    ? resolvedParams.locale
    : 'pl';
  const data = await getDealData(resolvedParams.id);
  
  // Deal not found or hidden (draft/rejected) — notFound() returns 404.
  // generateMetadata already sets noindex for 'gone' deals, so Google won't re-index.
  if (!data || ('gone' in data && data.gone)) {
    notFound();
  }
  
  // Deep-serialize ALL data to ensure no Firestore class instances (Timestamp, DocumentReference, etc.)
  // cross the Server→Client boundary, which would cause HTTP 500.
  const deal = deepSerialize(data.deal);
  const relatedDeals = deepSerialize(data.relatedDeals);
  const product = deepSerialize(data.product);
  
  const isExpired = data.expired || false;
  
  // JSON-LD structured data dla Google Rich Results
  const dealTitle = typeof deal.title === 'string' ? deal.title : deal.title?.pl || 'Okazja';
  const dealDescription = typeof deal.description === 'string' ? deal.description : deal.description?.pl || '';
  
  const jsonLd = generateDealJsonLd(deal);
  const breadcrumbList = generateBreadcrumbJsonLd(
    dealTitle,
    deal.id,
    deal.mainCategorySlug
      ? {
          name:
            humanizeCategorySlug(deal.subSubCategorySlug)
            || humanizeCategorySlug(deal.subCategorySlug)
            || humanizeCategorySlug(deal.mainCategorySlug),
          path: buildCategoryPath(locale, deal.mainCategorySlug, deal.subCategorySlug, deal.subSubCategorySlug),
        }
      : undefined,
    'deals'
  );
  
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
      
      {/* Breadcrumbs z mikroformatami */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center space-x-2 text-sm text-gray-500">
          <li>
            <Link href="/" className="hover:text-blue-600">Strona główna</Link>
          </li>
          <li><span className="text-gray-400">/</span></li>
          <li>
            <Link href="/deals" className="hover:text-blue-600">Okazje</Link>
          </li>
          {categoryPath.map((step, index) => (
            <li key={step.url} className="flex items-center space-x-2">
              <span className="text-gray-400">/</span>
              {index === categoryPath.length - 1 ? (
                <span className="text-gray-900 font-medium truncate max-w-[200px]" aria-current="page">
                  {step.name}
                </span>
              ) : (
                <Link href={step.url} className="hover:text-blue-600 truncate max-w-[150px]">
                  {step.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {isExpired && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Okazja wygasła</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Ta oferta dobiegła końca lub nie jest już dostępna. Poniżej znajdziesz informacje archiwale.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client component z interaktywnym UI */}
      <DealDetailClient 
        deal={deal}
        product={product}
        relatedDeals={relatedDeals}
      />
    </>
  );
}
