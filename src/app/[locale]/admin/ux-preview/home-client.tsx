'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { Deal, Product, Category, Subcategory, SubSubcategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { UXRedesignDealCard } from '@/components/ux-redesign/deal-card';
import { UXRedesignProductCard } from '@/components/ux-redesign/product-card';
import { Flame, ShoppingBag, Sparkles, ArrowRight, TrendingUp, Users, Percent, ChevronDown, ChevronRight, X, Grid3X3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const AutocompleteSearch = dynamic(
  () => import('@/components/autocomplete-search').then((m) => ({ default: m.AutocompleteSearch })),
  { ssr: false }
);

function getLocalizedText(value: unknown, fallback = 'Oferta'): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const candidate = localized.pl || localized.en || localized.de;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

interface Props {
  initialHotDeals: Deal[];
  initialTopProducts: Product[];
  categories: Category[];
}

// CategoryTree — interactive 3-level collapsible category browser
function CategoryTree({ categories, locale }: { categories: Category[]; locale: string }) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);

  const toggleCat = (slug: string) => {
    setOpenCat(prev => prev === slug ? null : slug);
    setOpenSub(null); // close any open subcategory when switching parent
  };

  const toggleSub = (slug: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenSub(prev => prev === slug ? null : slug);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {categories.slice(0, 15).map((cat) => {
        const isCatOpen = openCat === cat.slug;
        const hasSubcats = (cat.subcategories?.length ?? 0) > 0;

        return (
          <div key={cat.slug} className="relative">
            {/* Category button */}
            <button
              onClick={() => hasSubcats ? toggleCat(cat.slug) : undefined}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 text-left group",
                isCatOpen
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : "bg-background/55 hover:bg-background border-border/40 hover:border-primary/40 hover:shadow-md"
              )}
            >
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 transition-all",
                isCatOpen ? "bg-white/20 text-white" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
              )}>
                {cat.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-bold text-sm truncate transition-colors",
                  isCatOpen ? "text-white" : "text-foreground group-hover:text-primary"
                )}>
                  {cat.name}
                </p>
                {hasSubcats && (
                  <p className={cn(
                    "text-[10px] transition-colors",
                    isCatOpen ? "text-white/70" : "text-muted-foreground"
                  )}>
                    {cat.subcategories!.length} podkategorii
                  </p>
                )}
              </div>
              {hasSubcats && (
                <ChevronDown className={cn(
                  "h-4 w-4 flex-shrink-0 transition-transform duration-200",
                  isCatOpen ? "rotate-180 text-white" : "text-muted-foreground"
                )} />
              )}
              {!hasSubcats && (
                <Link
                  href={`/${locale}/deals?mainCategory=${cat.slug}`}
                  className="absolute inset-0 rounded-2xl"
                  aria-label={cat.name}
                />
              )}
            </button>

            {/* Dropdown subcategories panel */}
            {isCatOpen && hasSubcats && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-background border border-border/60 rounded-2xl shadow-2xl overflow-hidden">
                {/* Category link at the top */}
                <Link
                  href={`/${locale}/deals?mainCategory=${cat.slug}`}
                  className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-primary hover:bg-primary/5 transition-colors border-b border-border/40"
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  Wszystkie w: {cat.name}
                  <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                </Link>

                <div className="max-h-72 overflow-y-auto py-1.5 space-y-0.5">
                  {cat.subcategories!.map((sub) => {
                    const isSubOpen = openSub === sub.slug;
                    const hasSubSubs = (sub.subcategories?.length ?? 0) > 0;

                    return (
                      <div key={sub.slug}>
                        {/* Subcategory row */}
                        <div className="flex items-center gap-2 px-3 py-0.5 group/sub">
                          {hasSubSubs ? (
                            <button
                              onClick={(e) => toggleSub(sub.slug, e)}
                              className="flex-1 flex items-center justify-between px-2 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/70 transition-colors text-left"
                            >
                              <span className="truncate">{sub.name}</span>
                              <ChevronDown className={cn(
                                "h-3.5 w-3.5 flex-shrink-0 ml-2 text-muted-foreground transition-transform duration-150",
                                isSubOpen && "rotate-180"
                              )} />
                            </button>
                          ) : (
                            <Link
                              href={`/${locale}/deals?mainCategory=${cat.slug}&subCategory=${sub.slug}`}
                              onClick={() => setOpenCat(null)}
                              className="flex-1 flex items-center justify-between px-2 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-muted/70 hover:text-primary transition-colors"
                            >
                              <span className="truncate">{sub.name}</span>
                              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 ml-2 text-muted-foreground" />
                            </Link>
                          )}
                        </div>

                        {/* Sub-subcategories */}
                        {isSubOpen && hasSubSubs && (
                          <div className="ml-4 mr-2 mb-1 bg-muted/40 rounded-xl overflow-hidden">
                            <Link
                              href={`/${locale}/deals?mainCategory=${cat.slug}&subCategory=${sub.slug}`}
                              onClick={() => setOpenCat(null)}
                              className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-primary hover:bg-primary/5 transition-colors border-b border-border/30"
                            >
                              <Grid3X3 className="h-3 w-3" /> Wszystkie w: {sub.name}
                            </Link>
                            {sub.subcategories!.map((subsub) => (
                              <Link
                                key={subsub.slug}
                                href={`/${locale}/deals?mainCategory=${cat.slug}&subCategory=${sub.slug}&subSubCategory=${subsub.slug}`}
                                onClick={() => setOpenCat(null)}
                                className="flex items-center justify-between px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                              >
                                <span className="truncate">{subsub.name}</span>
                                <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-50" />
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function UXPreviewHomeClient({ initialHotDeals, initialTopProducts, categories }: Props) {
  const t = useTranslations('home');
  const locale = useLocale();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const featureDeal = initialHotDeals[0];
  const hotDeals = initialHotDeals.slice(0, 8);
  const topProducts = initialTopProducts.slice(0, 8);

  const featureTitle = featureDeal ? getLocalizedText(featureDeal.title) : '';
  const featureImage = featureDeal ? (featureDeal.image || (featureDeal as any).imageUrl || '/icon_okazjeplus.svg') : '/icon_okazjeplus.svg';

  return (
    <div className="space-y-16 pb-24">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-8 md:pt-16 lg:pt-20">
        <div className="container mx-auto px-4">
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
                  <Link href={`/${locale}/admin/ux-preview/deals`}>
                    <Flame className="mr-1.5 h-3.5 w-3.5 text-orange-500" />
                    Przeglądaj okazje
                  </Link>
                </Button>
                <Button size="sm" variant="outline" className="rounded-full font-semibold border-border/60 hover:bg-muted text-xs px-4" asChild>
                  <Link href={`/${locale}/admin/ux-preview/products`}>
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
                        {featureDeal.price ? `${featureDeal.price} PLN` : 'Gratis'}
                      </span>
                      {featureDeal.originalPrice && (
                        <span className="text-xs text-muted-foreground line-through opacity-70">
                          {featureDeal.originalPrice} PLN
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
      <section className="container mx-auto px-4">
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

      {/* 3. CATEGORIES — interactive 3-level tree */}
      <section className="container mx-auto px-4">
        <div className="text-left mb-6 flex justify-between items-end">
          <div className="space-y-1">
            <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight">
              Przeglądaj Kategorie
            </h2>
            <p className="text-xs text-muted-foreground">Kliknij kategorię aby rozwinąć podkategorie, a następnie wybierz interesującą Cię grupę</p>
          </div>
        </div>
        <CategoryTree categories={categories} locale={locale} />
      </section>

      {/* 4. HOT DEALS SECTION */}
      <section className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="h-6 w-6 text-orange-500" />
              <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight">
                Gorące Okazje
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">Najwyżej ocenione i najbardziej opłacalne znaleziska</p>
          </div>
          <Button variant="outline" className="rounded-xl border-border/60 hover:bg-muted text-xs" asChild>
            <Link href={`/${locale}/admin/ux-preview/deals`}>
              Zobacz wszystkie
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {hotDeals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {hotDeals.map((deal) => (
              <UXRedesignDealCard key={deal.id} deal={deal} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 border border-dashed rounded-3xl">
            Brak gorących okazji
          </div>
        )}
      </section>

      {/* 5. TOP PRODUCTS COMPARISON */}
      <section className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              <h2 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight">
                Katalog Produktów
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">Porównuj oferty i znajduj najtańsze sklepy</p>
          </div>
          <Button variant="outline" className="rounded-xl border-border/60 hover:bg-muted text-xs" asChild>
            <Link href={`/${locale}/admin/ux-preview/products`}>
              Zobacz wszystkie
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {topProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {topProducts.map((product) => (
              <UXRedesignProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 border border-dashed rounded-3xl">
            Brak produktów w katalogu
          </div>
        )}
      </section>
    </div>
  );
}
