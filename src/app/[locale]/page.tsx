import { Metadata } from 'next';
import HomeClient from './home-client';
import { getRecommendedProducts, getCategories } from '@/lib/data';
import { searchDealsTypesense } from '@/lib/search';
import { generateHomePageJsonLd } from '@/lib/json-ld-generators';

// Cache home page more aggressively for better performance
export const revalidate = 300; // ISR co 5 minut dla niższego kosztu backendu i stabilniejszego TTFB

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://okazjeplus.pl';

const OG_LOCALES: Record<string, string> = {
  pl: 'pl_PL',
  en: 'en_US',
  de: 'de_DE',
  fr: 'fr_FR',
  es: 'es_ES',
  uk: 'uk_UA',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const currentLocale = locale || 'pl';
  const canonical = `${SITE_URL}/${currentLocale}`;

  return {
    title: 'Okazje Plus - Najlepsze promocje i produkty w jednym miejscu',
    description: 'Odkryj najgorętsze okazje i promocje! Społeczność dzieląca się najlepszymi znaleziskami. Produkty, kody rabatowe, wyprzedaże i więcej.',
    keywords: 'okazje, promocje, wyprzedaże, kody rabatowe, tanie zakupy, najlepsze ceny, hot deals, produkty, sklepy internetowe',
    openGraph: {
      title: 'Okazje Plus - Najlepsze promocje i produkty',
      description: 'Społeczność łowców okazji. Odkrywaj najlepsze promocje, dziel się znaleziskami, oszczędzaj!',
      url: canonical,
      siteName: 'Okazje Plus',
      locale: OG_LOCALES[currentLocale] || OG_LOCALES.pl,
      type: 'website',
      images: [
        {
          url: 'https://okazjeplus.pl/og-home.jpg',
          width: 1200,
          height: 630,
          alt: 'Okazje Plus - Najlepsze promocje',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Okazje Plus - Społeczność łowców okazji',
      description: 'Odkryj najgorętsze promocje i produkty. Dołącz do społeczności!',
    },
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function HomePage() {
  // Load data for home page
  const [hotDeals, topProducts, categories] = await Promise.all([
    searchDealsTypesense('*', {
      limit: 12,
      sortBy: 'hot',
      statusFilter: 'approved',
    }),
    getRecommendedProducts(8),
    getCategories(),
  ]);

  const homeJsonLd = generateHomePageJsonLd(hotDeals, topProducts);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <HomeClient 
        initialHotDeals={hotDeals}
        initialTopProducts={topProducts}
        categories={categories}
      />
    </>
  );
}

