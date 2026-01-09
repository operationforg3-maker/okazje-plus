import { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClient from './home-client';
import ComingSoonLanding from '@/components/coming-soon-landing';
import { getHotDeals, getRecommendedProducts, getCategories } from '@/lib/data';
import { getServerAuthSession } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';
export const revalidate = 180; // Revalidate co 3 minuty

export const metadata: Metadata = {
  title: 'Okazje Plus - Najlepsze promocje i produkty w jednym miejscu',
  description: 'Odkryj najgorętsze okazje i promocje! Społeczność dzieląca się najlepszymi znaleziskami. Produkty, kody rabatowe, wyprzedaże i więcej.',
  keywords: 'okazje, promocje, wyprzedaże, kody rabatowe, tanie zakupy, najlepsze ceny, hot deals, produkty, sklepy internetowe',
  openGraph: {
    title: 'Okazje Plus - Najlepsze promocje i produkty',
    description: 'Społeczność łowców okazji. Odkrywaj najlepsze promocje, dziel się znaleziskami, oszczędzaj!',
    url: 'https://okazje.plus',
    siteName: 'Okazje Plus',
    locale: 'pl_PL',
    type: 'website',
    images: [
      {
        url: 'https://okazje.plus/og-home.jpg',
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
    canonical: 'https://okazje.plus',
  },
};

export default async function HomePage() {
  // Check if user is admin - only admins see the full app
  const session = await getServerAuthSession();
  const isAdmin = session?.role === 'admin';

  // Show coming soon page for non-admin users
  if (!isAdmin) {
    return <ComingSoonLanding />;
  }

  // Admin users see the full homepage
  const [hotDeals, topProducts, categories] = await Promise.all([
    getHotDeals(12).catch(() => []),
    getRecommendedProducts(12).catch(() => []),
    getCategories().catch(() => []),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Ładowanie...</div>}>
      <HomeClient 
        initialHotDeals={hotDeals}
        initialTopProducts={topProducts}
        categories={categories}
      />
    </Suspense>
  );
}

