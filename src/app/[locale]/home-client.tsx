// @ts-nocheck
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UXRedesignDealCard } from '@/components/ux-redesign/deal-card';
import { UXRedesignProductCard } from '@/components/ux-redesign/product-card';
import {
  Flame,
  ShoppingBag,
  Users,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

const AutocompleteSearch = dynamic(
  () => import('@/components/autocomplete-search').then((m) => ({ default: m.AutocompleteSearch })),
  {
    ssr: false,
    loading: () => <div className="h-12 rounded-full border-2 bg-background/80" aria-hidden="true" />,
  }
);

// Dynamic imports for below-fold components — reduces TBT / main-thread parse cost
const CategoryGrid = dynamic(() => import('@/components/home/category-grid'), { ssr: false });
const RegistrationCTA = dynamic(() => import('@/components/home/registration-cta'), { ssr: false });
const HomeSecondarySections = dynamic(() => import('@/components/home/home-secondary-sections'), {
  ssr: false,
  loading: () => <div className="min-h-[1000px]" aria-hidden="true" />,
});

interface Props {
  initialHotDeals: Deal[];
  initialTopProducts: Product[];
  categories: Category[];
}

function getLocalizedText(value: unknown, fallback = 'Oferta'): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const candidate = localized.pl || localized.en || localized.de;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function formatPrice(v: any, currency = 'PLN'): string | null {
  const n = typeof v === 'number' ? v
    : typeof v === 'object' && v?.amount ? v.amount
    : parseFloat(String(v || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
  if (isNaN(n) || n <= 0) return null;
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(n);
}

export default function HomeClient({ initialHotDeals, initialTopProducts, categories }: Props) {
  const t = useTranslations('home');
  const locale = useLocale();
  const secondarySectionRef = useRef<HTMLDivElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showSecondarySections, setShowSecondarySections] = useState(false);

  const visibleHotDeals = initialHotDeals.slice(0, 8);
  const visibleTopProducts = initialTopProducts.slice(0, 8);

  const featureDeal = initialHotDeals[0];
  const featureTitle = featureDeal ? getLocalizedText(featureDeal.title) : '';
  const featureImage = featureDeal ? (featureDeal.image || (featureDeal as any).imageUrl || '/icon_okazjeplus.svg') : '/icon_okazjeplus.svg';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const secondaryNode = secondarySectionRef.current;
    if (!secondaryNode) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === secondaryNode) setShowSecondarySections(true);
        }
      },
      { rootMargin: '120px 0px' }
    );

    observer.observe(secondaryNode);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-8 md:pt-16 lg:pt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background to-background" />

        <div className="page-container relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left side text */}
            <div className="lg:col-span-7 space-y-8 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider animate-bounce">
                <Sparkles className="h-4 w-4" />
                {t('hero.badge')}
              </div>
              
              <h1 className="font-headline text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] text-foreground">
                Znajduj najlepsze <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 drop-shadow-sm">
                  Okazje i Promocje
                </span>
              </h1>
              
              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl font-medium leading-relaxed">
                Społeczność łowców okazji dzieląca się sprawdzonymi ofertami, kodami rabatowymi i wyprzedażami. Kupuj mądrzej!
              </p>

              {/* Search Bar */}
              <div className="max-w-xl">
                {isMounted ? (
                  <AutocompleteSearch className="rounded-2xl border border-border/40 shadow-xl bg-background/90 p-1.5 focus-within:ring-2 focus-within:ring-primary/20 backdrop-blur-md" />
                ) : (
                  <div className="h-14 rounded-2xl border bg-background/50 animate-pulse" />
                )}
              </div>

              {/* Quick Navigation Chips */}
              <div className="flex flex-wrap gap-2.5 pt-2">
                <Button size="sm" variant="outline" className="rounded-full font-semibold border-border/60 hover:bg-muted text-xs px-4" asChild>
                  <Link href={`/${locale}/deals`}>
                    <Flame className="mr-1.5 h-3.5 w-3.5 text-orange-500" />
                    Przeglądaj okazje
                  </Link>
                </Button>
                <Button size="sm" variant="outline" className="rounded-full font-semibold border-border/60 hover:bg-muted text-xs px-4" asChild>
                  <Link href={`/${locale}/products`}>
                    <ShoppingBag className="mr-1.5 h-3.5 w-3.5 text-primary" />
                    Katalog produktów
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right side floating showcase card */}
            {featureDeal && (
              <div className="lg:col-span-5 relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-3xl blur-2xl group-hover:scale-105 transition-transform duration-500" />
                <div className="relative bg-background/55 backdrop-blur-xl border border-border/40 p-5 rounded-3xl shadow-2xl flex flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                      Okazja tygodnia
                    </span>
                    <span className="flex items-center gap-1 text-xs text-orange-500 font-black">
                      <Flame className="h-4 w-4 animate-pulse" />
                      +{Math.round(featureDeal.temperature || 0)}°
                    </span>
                  </div>
                  
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted">
                    <img 
                      src={featureImage} 
                      alt={featureTitle}
                      className="object-cover w-full h-full group-hover:scale-102 transition-transform duration-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                      {featureTitle}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-foreground">
                        {formatPrice(featureDeal.price) || 'Gratis'}
                      </span>
                      {featureDeal.originalPrice && formatPrice(featureDeal.originalPrice) !== formatPrice(featureDeal.price) && (
                        <span className="text-xs text-muted-foreground line-through opacity-70">
                          {formatPrice(featureDeal.originalPrice)}
                        </span>
                      )}
                    </div>
                    <Button size="sm" className="rounded-xl font-bold bg-primary text-primary-foreground shadow-md" asChild>
                      <Link href={`/${locale}/deals/${featureDeal.id}`}>
                        Odbierz okazję
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. STATS BAR WIDGET */}
      <section className="page-container py-12">
        <div className="bg-background/40 backdrop-blur-md border border-border/40 p-6 rounded-3xl shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="space-y-1 flex flex-col items-center">
            <div className="bg-orange-500/10 p-2.5 rounded-2xl text-orange-500 mb-2">
              <Flame className="h-5 w-5" />
            </div>
            <span className="text-2xl font-black tracking-tight text-foreground">12 690+</span>
            <span className="text-xs text-muted-foreground font-medium">Zweryfikowanych okazji</span>
          </div>
          <div className="space-y-1 flex flex-col items-center border-y md:border-y-0 md:border-x border-border/40 py-4 md:py-0">
            <div className="bg-primary/10 p-2.5 rounded-2xl text-primary mb-2">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <span className="text-2xl font-black tracking-tight text-foreground">4 640+</span>
            <span className="text-xs text-muted-foreground font-medium">Monitorowanych produktów</span>
          </div>
          <div className="space-y-1 flex flex-col items-center">
            <div className="bg-violet-500/10 p-2.5 rounded-2xl text-violet-500 mb-2">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-2xl font-black tracking-tight text-foreground">15 400+</span>
            <span className="text-xs text-muted-foreground font-medium">Aktywnych łowców okazji</span>
          </div>
        </div>
      </section>

      {/* 3. CATEGORIES SHOWCASE */}
      <section
        className="py-12 bg-background"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}
      >
        <div className="page-container">
          <div className="text-left mb-8 space-y-1">
            <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight">
              {t('categories.title')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('categories.subtitle')}</p>
          </div>

          {categories.length > 0 ? (
            <div className="space-y-8">
              <CategoryGrid categories={categories} />
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

      {/* 4. TOP PRODUCTS CATALOG SECTION */}
      <section className="py-12 bg-card/50">
        <div className="page-container">
          <div className="flex items-end justify-between mb-8">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-6 w-6 text-primary" />
                <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight">
                  Katalog Produktów
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">Porównuj oferty i znajduj najtańsze sklepy</p>
            </div>
            <Button variant="outline" className="rounded-xl border-border/60 hover:bg-muted text-xs" asChild>
              <Link href={`/${locale}/products`}>
                Zobacz wszystkie
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {visibleTopProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {visibleTopProducts.map((product) => (
                <UXRedesignProductCard key={product.id} product={product} />
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

      {/* 5. REGISTRATION CTA */}
      <RegistrationCTA />

      {/* 6. HOT DEALS SECTION */}
      <section className="py-12">
        <div className="page-container">
          <div className="flex items-end justify-between mb-8">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight">
                  Gorące Okazje
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">Najwyżej ocenione i najbardziej opłacalne znaleziska</p>
            </div>
            <Button variant="outline" className="rounded-xl border-border/60 hover:bg-muted text-xs" asChild>
              <Link href={`/${locale}/deals`}>
                Zobacz wszystkie
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {visibleHotDeals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {visibleHotDeals.map((deal, idx) => (
                <UXRedesignDealCard key={deal.id} deal={deal} priority={idx === 0} />
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

      {/* 7. OTHER SECONDARY SECTIONS */}
      <div ref={secondarySectionRef} style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 1000px' }}>
        {showSecondarySections ? <HomeSecondarySections /> : <div className="min-h-[1000px]" aria-hidden="true" />}
      </div>
    </div>
  );
}
