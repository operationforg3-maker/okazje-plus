import { Metadata } from 'next';
import HomeClient from './home-client';
import { getRecommendedProducts, getCategories } from '@/lib/data';
import { searchDealsTypesense } from '@/lib/search';
import { generateHomePageJsonLd } from '@/lib/json-ld-generators';

// Cache home page more aggressively for better performance
export const revalidate = 60; // ISR co 1 minutę dla lepszego TTFB/LCP bez pełnej dynamiki

export const metadata: Metadata = {
  title: 'Okazje Plus - Najlepsze promocje i produkty w jednym miejscu',
  description: 'Odkryj najgorętsze okazje i promocje! Społeczność dzieląca się najlepszymi znaleziskami. Produkty, kody rabatowe, wyprzedaże i więcej.',
  keywords: 'okazje, promocje, wyprzedaże, kody rabatowe, tanie zakupy, najlepsze ceny, hot deals, produkty, sklepy internetowe',
  openGraph: {
    title: 'Okazje Plus - Najlepsze promocje i produkty',
    description: 'Społeczność łowców okazji. Odkrywaj najlepsze promocje, dziel się znaleziskami, oszczędzaj!',
    url: 'https://okazjeplus.pl',
    siteName: 'Okazje Plus',
    locale: 'pl_PL',
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
    canonical: 'https://okazjeplus.pl',
  },
};

export default async function HomePage() {
  // Load data for home page
  const [hotDeals, topProducts, categories] = await Promise.all([
    searchDealsTypesense('*', {
      limit: 20,
      sortBy: 'hot',
      statusFilter: 'approved',
    }),
    getRecommendedProducts(12),
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

