"use client";

import { Deal, Product } from '@/lib/types';
import { useTranslations } from 'next-intl';
import HeroSection from '@/components/hero-section';
import { StatsStrip } from '@/components/stats-strip';
import { DealsGrid } from '@/components/deals-grid';
import { ProductsGrid } from '@/components/products-grid';

interface HomeClientProps {
  initialHotDeals: Deal[];
  initialRecommendedProducts: Product[];
}

export default function HomeClient({ initialHotDeals, initialRecommendedProducts }: HomeClientProps) {
  const t = useTranslations('home');

  return (
    <div className="space-y-10">
      {/* Hero z wyszukiwarką */}
      <HeroSection />

      {/* Statystyki portalu */}
      <StatsStrip />

      <div className="px-4 py-6 max-w-7xl mx-auto space-y-12">
        {/* Gorące okazje */}
        <section>
          <h2 className="text-2xl font-bold mb-6">{t('hotDeals') || 'Gorące okazje'}</h2>
          {initialHotDeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noDeals') || 'Brak zaakceptowanych okazji do wyświetlenia.'}</p>
          ) : (
            <DealsGrid deals={initialHotDeals} showViewToggle={false} defaultView="grid" />
          )}
        </section>

        {/* Polecane produkty */}
        <section>
          <h2 className="text-2xl font-bold mb-6">{t('recommendedProducts') || 'Polecane produkty'}</h2>
          {initialRecommendedProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noProducts') || 'Brak zaakceptowanych produktów do wyświetlenia.'}</p>
          ) : (
            <ProductsGrid products={initialRecommendedProducts} showViewToggle={false} defaultView="grid" />
          )}
        </section>
      </div>
    </div>
  );
}