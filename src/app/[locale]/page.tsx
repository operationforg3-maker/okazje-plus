import { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClient from './home-client';
import { getHotDeals, getRecommendedProducts, getCategories } from '@/lib/data';
import { getServerAuthSession } from '@/lib/auth-server';

// Cache home page more aggressively for better performance
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate co 1 minutę (było 180) dla lepszych Core Web Vitals

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
  const [hotDeals, topProducts, categories, session] = await Promise.all([
    getHotDeals(20),
    getRecommendedProducts(12),
    getCategories(),
    getServerAuthSession(),
  ]);

  return (
    <HomeClient 
      initialHotDeals={hotDeals}
      initialTopProducts={topProducts}
      categories={categories}
    />
  );
}

