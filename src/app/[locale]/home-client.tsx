// @ts-nocheck
'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Deal, Product, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DealCard from '@/components/new-ux/deal-card';
import ProductCard from '@/components/new-ux/product-card';
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

const CategoryGrid = dynamic(() => import('@/components/new-ux/category-accordion'), { ssr: false });
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
    // Większy kontener - dopasowuje się do siatki (h-full na desktopie, min-height na mobile)
    <div className="relative w-full h-full min-h-[420px] md:min-h-[460px] lg:h-[500px]">
      {/* Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-accent/30 rounded-[2rem] blur-2xl opacity-60 pointer-events-none" />

      {/* Karta kontenera */}
      <div className="relative w-full h-full bg-background border border-border/40 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">

        {/* Wszystkie slajdy */}
        {deals.map((deal, idx) => {
          const title = getLocalizedText(deal.title);
          const image = deal.image || (deal as any).imageUrl || '/icon_okazjeplus.svg';
          const price = formatPrice(deal.price);
          const origPrice = formatPrice(deal.originalPrice);
          const discount = calcDiscount(deal);
          const isActive = idx === active;
          const sales = deal.metrics?.soldCount || (deal as any).soldCount || deal.salesCount;

          return (
            <div
              key={deal.id ?? idx}
              aria-hidden={!isActive}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.45s ease',
                pointerEvents: isActive ? 'auto' : 'none',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Cała karta jest linkiem */}
              <Link href={`/${locale}/deals/${deal.id}`} className="flex-1 flex flex-col group overflow-hidden relative z-10">
                
                {/* Zdjęcie wypełniające górę - ze sztuczką bluru zamiast chamskiego ucinania */}
                <div className="relative flex-1 w-full bg-background overflow-hidden flex items-center justify-center">
                  
                  {/* Tło z blurem dla spójnego wypełnienia (rozwiązuje problem dziwnego kadrowania proporcji na mobile) */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl scale-125"
                    style={{ backgroundImage: `url(${image})` }}
                  />

                  {/* Właściwe zdjęcie (w całości widoczne, na wierzchu bluru) */}
                  <img
                    src={image}
                    alt={title}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    fetchPriority={idx === 0 ? 'high' : 'auto'}
                    decoding={idx === 0 ? 'sync' : 'async'}
                    className="relative w-full h-full object-contain p-4 transition-transform duration-700 md:group-hover:scale-105"
                  />

                  {/* Ciemniejszy gradient z góry dla kontrastu tekstu (badge) */}
                  <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-10" />
                  
                  {/* Etykiety i zniżki nałożone na zdjęcie */}
                  <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20">
                    <span className="bg-orange-500 text-white text-[10px] md:text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                      <Flame className="h-3.5 w-3.5 animate-pulse" />
                      Okazja Tygodnia
                    </span>
                    <div className="flex flex-col items-end gap-1.5">
                      {discount > 0 && (
                        <span className="bg-green-500 text-white font-black text-xs md:text-sm px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                          <TrendingDown className="h-3.5 w-3.5" />
                          -{discount}%
                        </span>
                      )}
                      {sales > 10 && (
                        <span className="bg-background/95 backdrop-blur-sm text-foreground text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                          Kupiono {sales}+ szt.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Treść na dole karty */}
                <div className="bg-background px-5 py-5 shrink-0 z-20 flex flex-col justify-end">
                  <h3 className="font-bold text-base md:text-lg leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {title}
                  </h3>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-primary">{price || 'Sprawdź'}</span>
                        {origPrice && origPrice !== price && (
                          <span className="text-sm text-muted-foreground line-through opacity-70">{origPrice}</span>
                        )}
                      </div>
                    </div>
                    {/* Fake button purely for UI */}
                    <div className="rounded-xl font-bold bg-primary text-primary-foreground shadow-md text-sm px-4 py-2 flex items-center transition-transform group-hover:scale-105">
                      Odbierz okazję
                    </div>
                  </div>
                </div>
              </Link>

              {/* Strzałki nawigacji nałożone na zdjęcie, oddzielone od Linka (z-30) */}
              {isActive && (
                <>
                  <button
                    onClick={(e) => { e.preventDefault(); prev(); resetTimer(); }}
                    className="absolute left-3 top-[35%] p-2.5 rounded-full bg-background/80 backdrop-blur-md shadow-xl hover:bg-background hover:scale-110 transition-all z-30"
                    aria-label="Poprzednia okazja"
                  >
                    <ChevronLeft className="h-5 w-5 text-foreground" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); next(); resetTimer(); }}
                    className="absolute right-3 top-[35%] p-2.5 rounded-full bg-background/80 backdrop-blur-md shadow-xl hover:bg-background hover:scale-110 transition-all z-30"
                    aria-label="Następna okazja"
                  >
                    <ChevronRight className="h-5 w-5 text-foreground" />
                  </button>
                </>
              )}
            </div>
          );
        })}

        {/* Kropki nawigacji - połączone z dolną krawędzią całej karty */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-30 pointer-events-none">
          {deals.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); setActive(i); resetTimer(); }}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300 pointer-events-auto',
                i === active ? 'w-5 bg-primary' : 'w-1.5 bg-border/80 hover:bg-primary/50'
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
