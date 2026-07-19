// @ts-nocheck
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DealCard from '@/components/deal-card';
import ProductCard from '@/components/product-card';
import {
  Flame,
  ShoppingBag,
  Users,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const AutocompleteSearch = dynamic(
  () => import('@/components/autocomplete-search').then((m) => ({ default: m.AutocompleteSearch })),
  {
    ssr: false,
    loading: () => <div className="h-12 rounded-full border-2 bg-background/80" aria-hidden="true" />,
  }
);

const CategoryGrid = dynamic(() => import('@/components/category-accordion'), { ssr: false });
const RegistrationCTA = dynamic(() => import('@/components/home/registration-cta'), { ssr: false });
const HomeSecondarySections = dynamic(() => import('@/components/home/home-secondary-sections'), {
  ssr: false,
  loading: () => <div className="min-h-[1000px]" aria-hidden="true" />,
});

interface Props {
  initialHotDeals: Deal[];
  initialTopProducts: Product[];
  categories: Category[];
  weeklyDeals?: Deal[];
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

function calcDiscount(deal: Deal): number {
  const price = typeof deal.price === 'number' ? deal.price : 0;
  const orig = typeof deal.originalPrice === 'number' ? deal.originalPrice : 0;
  if (orig > 0 && price > 0 && orig > price) {
    return Math.round(((orig - price) / orig) * 100);
  }
  return 0;
}

// ============================================================
// Karuzela "Okazja Tygodnia" — stała wysokość, cross-fade bez skoków
// ============================================================
function WeeklyShowcaseCarousel({ deals, locale }: { deals: Deal[]; locale: string }) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => setActive(i => (i + 1) % deals.length), [deals.length]);
  const prev = useCallback(() => setActive(i => (i - 1 + deals.length) % deals.length), [deals.length]);

  useEffect(() => {
    timerRef.current = setInterval(next, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next]);

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(next, 5000);
  };

  if (!deals.length) return null;

  return (
    // Stała wysokość ~480px, by karuzela była większa
    <div className="relative w-full max-w-lg mx-auto" style={{ height: 480 }}>
      {/* Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 to-accent/25 rounded-3xl blur-2xl opacity-60 pointer-events-none" />

      {/* Karta kontenera — struktura z wzoru HeroVariantCurrent */}
      <div className="relative bg-background/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-xl overflow-hidden p-6 space-y-5" style={{ height: 480 }}>
        
        {/* Wszystkie slajdy renderowane naraz — tylko aktywny jest widoczny (opacity transition) */}
        {deals.map((deal, idx) => {
          const title = getLocalizedText(deal.title);
          const image = deal.image || (deal as any).imageUrl || '/icon_okazjeplus.svg';
          const price = formatPrice(deal.price);
          const origPrice = formatPrice(deal.originalPrice);
          const discount = calcDiscount(deal);
          const isActive = idx === active;

          return (
            <div
              key={deal.id ?? idx}
              aria-hidden={!isActive}
              className="absolute inset-0 p-6 flex flex-col space-y-4"
              style={{
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.4s ease-in-out',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              {/* Header: Znaczki */}
              <div className="flex items-center justify-between shrink-0">
                <span className="bg-orange-500/15 text-orange-500 border border-orange-500/25 text-[10px] sm:text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <Flame className="h-3.5 w-3.5 animate-pulse" />
                  Okazja Tygodnia
                </span>
                <span className="text-sm text-orange-500 font-black flex items-center gap-1">
                  <Flame className="h-4 w-4" />
                  +{Math.round(deal.temperature || 0)}°
                </span>
              </div>

              {/* Obraz (więcej przestrzeni, z tłem masonry) */}
              <Link href={`/${locale}/deals/${deal.id}`} className="flex-1 bg-sky-500/10 dark:bg-sky-500/5 rounded-2xl flex items-center justify-center relative overflow-hidden group outline-none">
                <img
                  src={image}
                  alt={title}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                />

                {/* Strzałki wewnątrz obszaru obrazka */}
                {isActive && (
                  <>
                    <button
                      onClick={(e) => { e.preventDefault(); prev(); resetTimer(); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 shadow-md hover:bg-background hover:scale-110 transition-all duration-200 z-20"
                      aria-label="Poprzednia okazja"
                    >
                      <ChevronLeft className="h-5 w-5 text-foreground" />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); next(); resetTimer(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 shadow-md hover:bg-background hover:scale-110 transition-all duration-200 z-20"
                      aria-label="Następna okazja"
                    >
                      <ChevronRight className="h-5 w-5 text-foreground" />
                    </button>
                  </>
                )}
              </Link>

              {/* Treść z cenami - dokładnie wg wzoru */}
              <div className="space-y-3 shrink-0 pb-1">
                <div style={{ height: 48, overflow: 'hidden' }}>
                  <Link href={`/${locale}/deals/${deal.id}`} className="font-bold text-base sm:text-lg text-foreground line-clamp-2 hover:text-primary transition-colors outline-none">
                    {title}
                  </Link>
                </div>
                
                <div className="flex items-baseline gap-2">
                  <Link href={`/${locale}/deals/${deal.id}`} className="flex items-baseline gap-2 outline-none">
                    <span className="text-2xl sm:text-3xl font-black text-foreground">{price || 'Sprawdź'}</span>
                    {origPrice && origPrice !== price && (
                      <span className="text-sm sm:text-base text-muted-foreground line-through">{origPrice}</span>
                    )}
                  </Link>
                  {discount > 0 && (
                    <span className="text-sm sm:text-base font-bold text-green-500 ml-auto flex-shrink-0">
                      -{discount}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Kropki nawigacji wyrównane na dnie absolutnie (aby nie skakały i mieściły się w układzie p-6) */}
        <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-1.5 z-30 pointer-events-none">
          {deals.map((_, i) => (
            <button
              key={i}
              onClick={() => { setActive(i); resetTimer(); }}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300 pointer-events-auto',
                i === active ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
              aria-label={`Okazja ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


// ============================================================
// Main HomeClient
// ============================================================
export default function HomeClient({ initialHotDeals, initialTopProducts, categories, weeklyDeals = [] }: Props) {
  const t = useTranslations('home');
  const locale = useLocale();
  const secondarySectionRef = useRef<HTMLDivElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showSecondarySections, setShowSecondarySections] = useState(false);

  const visibleHotDeals = initialHotDeals.slice(0, 12);
  const visibleTopProducts = initialTopProducts.slice(0, 12);
  const showcaseDeals = weeklyDeals.length > 0 ? weeklyDeals : initialHotDeals.slice(0, 5);

  useEffect(() => { setIsMounted(true); }, []);

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

      {/* ===========================
          1. HERO SECTION
          Brak overflow-hidden — autocomplete dropdown musi wychodzić nad hero!
      =========================== */}
      <section className="relative pt-8 md:pt-16 lg:pt-20 pb-4">
        {/* Ambient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background/40 to-transparent pointer-events-none" />
        {/* Bottom fade / shading — piękne przejście do następnej sekcji */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
        {/* Decorative ambient glow */}
        <div className="absolute top-1/3 -left-24 w-80 h-80 bg-primary/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/4 -right-24 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="page-container relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">

            {/* Left: Text + Search */}
            <div className="lg:col-span-6 space-y-7 text-left pt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                <Sparkles className="h-4 w-4" />
                {t('hero.badge')}
              </div>

              <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] text-foreground">
                Znajduj najlepsze <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-amber-500">
                  Okazje i Promocje
                </span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground max-w-lg font-medium leading-relaxed">
                Społeczność łowców okazji dzieląca się sprawdzonymi ofertami, kodami rabatowymi i wyprzedażami. Kupuj mądrzej!
              </p>

              {/* Search Bar — z-index 40 żeby dropdown był nad karuzelą i innymi elementami */}
              <div className="max-w-xl relative" style={{ zIndex: 40 }}>
                {isMounted ? (
                  <AutocompleteSearch className="rounded-2xl border border-border/40 shadow-xl bg-background/90 p-1.5 focus-within:ring-2 focus-within:ring-primary/20 backdrop-blur-md" />
                ) : (
                  <div className="h-14 rounded-2xl border bg-background/50 animate-pulse" />
                )}
              </div>

              {/* Quick Nav Chips */}
              <div className="flex flex-wrap gap-2.5 pt-1">
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

            {/* Right: Carousel "Okazja Tygodnia" */}
            {showcaseDeals.length > 0 && (
              <div className="lg:col-span-6 lg:min-h-[440px] relative" style={{ zIndex: 10 }}>
                <WeeklyShowcaseCarousel deals={showcaseDeals} locale={locale} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. STATS BAR */}
      <section className="page-container py-10">
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
      <section className="py-12 bg-background" style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}>
        <div className="page-container">
          <div className="text-left mb-8 space-y-1">
            <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight">
              {t('categories.title')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('categories.subtitle')}</p>
          </div>
          {categories.length > 0 ? (
            <CategoryGrid categories={categories} />
          ) : (
            <Card className="p-12 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t('categories.empty') || 'Kategorie wkrótce będą dostępne'}</p>
            </Card>
          )}
        </div>
      </section>

      {/* 4. TOP PRODUCTS */}
      <section className="py-12 bg-card/50">
        <div className="page-container">
          <div className="flex items-end justify-between mb-8">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-6 w-6 text-primary" />
                <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight">Katalog Produktów</h2>
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
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-6 space-y-6 w-full">
              {visibleTopProducts.map((product, idx) => (
                <div key={product.id} className="break-inside-avoid">
                  <ProductCard product={product} layoutMode="masonry" />
                </div>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t('topProducts.empty')}</p>
            </Card>
          )}
        </div>
      </section>

      {/* 5. REGISTRATION CTA */}
      <RegistrationCTA />

      {/* 6. HOT DEALS */}
      <section className="py-12">
        <div className="page-container">
          <div className="flex items-end justify-between mb-8">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight">Gorące Okazje</h2>
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
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-6 space-y-6 w-full">
              {visibleHotDeals.map((deal, idx) => (
                <div key={deal.id} className="break-inside-avoid">
                  <DealCard deal={deal} priority={idx === 0} layoutMode="masonry" index={idx} />
                </div>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Flame className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t('hotDeals.empty')}</p>
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
