// @ts-nocheck
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import HomeDealCard from '@/components/home/home-deal-card';
import HomeProductCard from '@/components/home/home-product-card';
const AutocompleteSearch = dynamic(
  () => import('@/components/autocomplete-search').then((m) => ({ default: m.AutocompleteSearch })),
  {
    ssr: false,
    loading: () => <div className="h-12 rounded-full border-2 bg-background/80" aria-hidden="true" />,
  }
);

// Dynamic imports for below-fold components — reduces TBT / main-thread parse cost
const CategoryGrid = dynamic(() => import('@/components/home/category-grid'), { ssr: false });
const RealTimeStats = dynamic(
  () => import('@/components/home/real-time-stats').then((m) => ({ default: m.RealTimeStats })),
  {
    ssr: false,
    loading: () => <div className="h-[160px]" aria-hidden="true" />,
  }
);
const HomeSecondarySections = dynamic(() => import('@/components/home/home-secondary-sections'), {
  ssr: false,
  loading: () => <div className="min-h-[1200px]" aria-hidden="true" />,
});
import {
  Flame,
  ShoppingBag,
  Star,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface Props {
  initialHotDeals: Deal[];
  initialTopProducts: Product[];
  categories: Category[];
}

export default function HomeClient({ initialHotDeals, initialTopProducts, categories }: Props) {
  const t = useTranslations('home');
  const categorySectionRef = useRef<HTMLElement | null>(null);
  const secondarySectionRef = useRef<HTMLDivElement | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showCategoryGrid, setShowCategoryGrid] = useState(false);
  const [showSecondarySections, setShowSecondarySections] = useState(false);

  const visibleHotDeals = initialHotDeals.slice(0, 4);
  const visibleTopProducts = initialTopProducts.slice(0, 4);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let rafId: number | null = null;

    const revealSearch = () => setShowSearch(true);

    if (typeof window !== 'undefined') {
      rafId = window.requestAnimationFrame(() => {
        timer = setTimeout(revealSearch, 350);
      });
    }

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const enableStats = () => setShowStats(true);

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: IdleRequestCallback) => number }).requestIdleCallback(() => enableStats());
    } else {
      fallbackTimer = setTimeout(enableStats, 700);
    }

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const categoryNode = categorySectionRef.current;
    const secondaryNode = secondarySectionRef.current;
    if (!categoryNode && !secondaryNode) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === categoryNode) setShowCategoryGrid(true);
          if (entry.target === secondaryNode) setShowSecondarySections(true);
        }
      },
      { rootMargin: '80px 0px' }
    );

    if (categoryNode) observer.observe(categoryNode);
    if (secondaryNode) observer.observe(secondaryNode);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background to-background" />

        <div className="page-container relative py-8 md:py-24 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Logo & Tagline */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                <Sparkles className="h-4 w-4" />
                {t('hero.badge')}
              </div>
              
              <h1 className="font-headline text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
                {t('hero.title.discover')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">{t('hero.title.best')}</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-primary">{t('hero.title.deals')}</span>
              </h1>
              
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto">
                {t('hero.subtitle')}
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              {showSearch ? (
                <AutocompleteSearch className="rounded-full border-2 focus-within:border-primary shadow-lg bg-background px-2 py-1" />
              ) : (
                <div className="h-12 rounded-full border-2 bg-background/80" aria-hidden="true" />
              )}
            </div>

            {/* Primary CTAs - Browse Categories + Add Deal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto pt-2 md:pt-4">
              <Button size="sm" variant="outline" className="rounded-full font-semibold text-xs sm:text-base py-2 sm:py-3 h-auto" asChild>
                <Link href="/deals">
                  <Flame className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Gorące okazje</span><span className="sm:hidden">Okazje</span>
                </Link>
              </Button>
              
              <Button size="sm" className="rounded-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 font-semibold text-white shadow-lg text-xs sm:text-base py-2 sm:py-3 h-auto sm:col-span-2 md:col-span-1" asChild>
                <Link href="/add-deal">
                  <Sparkles className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Dodaj okazję</span><span className="sm:hidden">Dodaj</span>
                </Link>
              </Button>
              
              <Button size="sm" variant="outline" className="rounded-full font-semibold text-xs sm:text-base py-2 sm:py-3 h-auto" asChild>
                <Link href="/products">
                  <ShoppingBag className="mr-1 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">Produkty</span><span className="sm:hidden">Artykuły</span>
                </Link>
              </Button>
            </div>

            {/* Quick Stats - Real time from database */}
            <div className="max-w-3xl mx-auto">
              {showStats ? <RealTimeStats /> : <div className="h-[160px]" aria-hidden="true" />}
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES SHOWCASE - Mega Menu with Images */}
      <section
        ref={categorySectionRef}
        className="py-16 bg-background"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}
      >
        <div className="page-container">
          <div className="text-center mb-12">
            <h2 className="font-headline text-4xl md:text-5xl font-bold mb-4">
              {t('categories.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('categories.subtitle')}</p>
          </div>

          {categories.length > 0 ? (
            <div className="space-y-8">
              {showCategoryGrid ? (
                <CategoryGrid categories={categories} />
              ) : (
                <div className="min-h-[360px]" aria-hidden="true" />
              )}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t('categories.empty') || 'Kategorie wkrótce będą dostępne'}
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* HOT DEALS SECTION */}
      <section className="py-16">
        <div className="page-container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-8 w-8 text-orange-500" />
                <h2 className="font-headline text-3xl md:text-4xl font-bold">
                  {t('hotDeals.title')}
                </h2>
              </div>
              <p className="text-muted-foreground">{t('hotDeals.subtitle')}</p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/deals">
                {t('hotDeals.viewAll')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {visibleHotDeals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {visibleHotDeals.map((deal, idx) => (
                <HomeDealCard key={deal.id} deal={deal} priority={idx === 0} />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Flame className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t('hotDeals.empty')}
              </p>
            </Card>
          )}
        </div>
      </section>

      {/* TOP PRODUCTS SECTION */}
      <section className="py-16 bg-card/50">
        <div className="page-container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-8 w-8 text-amber-500" />
                <h2 className="font-headline text-3xl md:text-4xl font-bold">
                  {t('topProducts.title')}
                </h2>
              </div>
              <p className="text-muted-foreground">{t('topProducts.subtitle')}</p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/products">
                {t('topProducts.viewAll')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {visibleTopProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {visibleTopProducts.map((product) => (
                <HomeProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {t('topProducts.empty')}
              </p>
            </Card>
          )}
        </div>
      </section>

      <div ref={secondarySectionRef} style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 1000px' }}>
        {showSecondarySections ? <HomeSecondarySections /> : <div className="min-h-[1000px]" aria-hidden="true" />}
      </div>
    </div>
  );
}
