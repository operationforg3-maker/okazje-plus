import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { doc, getDoc, collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal } from '@/lib/types';
import DealDetailClient from './deal-detail-client';

// Force dynamic rendering dla real-time danych
export const dynamic = 'force-dynamic';
export const revalidate = 300; // ISR: revalidate co 5 minut

interface PageProps {
  params: { id: string; locale: string };
}

// Server-side data fetching
async function getDealData(id: string) {
  const docRef = doc(db, "deals", id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const deal = { id: docSnap.id, ...docSnap.data() } as Deal;
  
  // Fetch related deals from same subcategory
  const relatedQuery = query(
    collection(db, "deals"),
    where("subCategorySlug", "==", deal.subCategorySlug),
    where("status", "==", "approved"),
    limit(4)
  );
  const relatedSnap = await getDocs(relatedQuery);
  const relatedDeals = relatedSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Deal))
    .filter(d => d.id !== id)
    .slice(0, 3);
  
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
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.price);
  const originalPrice = deal.originalPrice 
    ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(deal.originalPrice)
    : null;
  const discount = deal.originalPrice && deal.originalPrice > 0
    ? Math.round(((deal.originalPrice - deal.price) / deal.originalPrice) * 100)
    : null;
  
  const metaTitle = `${deal.title} - ${price}${discount ? ` (-${discount}%)` : ''} | Okazje Plus`;
  const dealTitle = deal.title?.pl || deal.title?.en || 'Okazja';
  const dealDescription = deal.description?.pl || deal.description?.en || '';
  const metaDescription = `${dealDescription.slice(0, 120)}... Temperatura: ${deal.temperature}°, ${deal.voteCount} głosów. ${originalPrice ? `Cena przed obniżką: ${originalPrice}.` : ''}`;
  
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
  const dealsRef = collection(db, "deals");
  const q = query(
    dealsRef,
    where("status", "==", "approved"),
    orderBy("temperature", "desc"),
    limit(100)
  );
  
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
    }));
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
