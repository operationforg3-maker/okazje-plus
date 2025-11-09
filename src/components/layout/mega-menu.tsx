"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  NavigationMenuItem,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  NavigationMenuContent,
} from "@/components/ui/navigation-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Flame, ArrowRight, Sparkles, ChevronRight, LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  getCategories,
  getDealById,
  getHotDeals,
  getNavigationShowcase,
  getProductById,
} from "@/lib/data";
import { Category, Deal, Product } from "@/lib/types";

const priceFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number") {
    return null;
  }
  return priceFormatter.format(value);
};

type ShowcaseItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  image?: string;
  price?: number;
  type: "deal" | "product";
  meta?: string;
};

type DealHighlight = {
  id: string;
  title: string;
  href: string;
  image?: string;
  temperature: number;
  price?: number;
  description?: string;
};

export function MegaMenu() {
  const { user, loading: authLoading, logout } = useAuth();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [promotedItems, setPromotedItems] = React.useState<ShowcaseItem[]>([]);
  const [dealOfTheDay, setDealOfTheDay] = React.useState<DealHighlight | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [fetchedCategories, showcaseConfig] = await Promise.all([
          getCategories(),
          getNavigationShowcase(),
        ]);

        if (!mounted) return;
        setCategories(fetchedCategories);

        let localPromoted: ShowcaseItem[] = [];
        let localDealOfTheDay: DealHighlight | null = null;

        if (showcaseConfig?.promotedIds?.length) {
          if (showcaseConfig.promotedType === "products") {
            const products = await Promise.all(
              showcaseConfig.promotedIds.map((id) => getProductById(id))
            );
            if (!mounted) return;
            localPromoted = products
              .filter((product): product is Product => Boolean(product))
              .map((product) => ({
                id: product.id,
                title: product.name,
                subtitle: product.description,
                href: `/products/${product.id}`,
                image: product.image,
                price: product.price,
                type: "product",
                meta: product.subCategorySlug ?? product.mainCategorySlug,
              }));
          } else {
            const deals = await Promise.all(
              showcaseConfig.promotedIds.map((id) => getDealById(id))
            );
            if (!mounted) return;
            localPromoted = deals
              .filter((deal): deal is Deal => Boolean(deal))
              .map((deal) => ({
                id: deal.id,
                title: deal.title,
                subtitle: deal.description,
                href: `/deals/${deal.id}`,
                image: deal.image,
                price: deal.price,
                type: "deal",
                meta: `${deal.temperature} pkt`,
              }));
          }
        }

        if (showcaseConfig?.dealOfTheDayId) {
          const highlightedDeal = await getDealById(showcaseConfig.dealOfTheDayId);
          if (!mounted) return;
          if (highlightedDeal) {
            localDealOfTheDay = {
              id: highlightedDeal.id,
              title: highlightedDeal.title,
              href: `/deals/${highlightedDeal.id}`,
              image: highlightedDeal.image,
              temperature: highlightedDeal.temperature,
              price: highlightedDeal.price,
              description: highlightedDeal.description,
            };
          }
        }

        if ((!localPromoted.length || !localDealOfTheDay) && mounted) {
          const fallbackDeals = await getHotDeals(4);
          if (!mounted) return;
          if (!localPromoted.length) {
            localPromoted = fallbackDeals.map((deal) => ({
              id: deal.id,
              title: deal.title,
              subtitle: deal.description,
              href: `/deals/${deal.id}`,
              image: deal.image,
              price: deal.price,
              type: "deal",
              meta: `${deal.temperature} pkt`,
            }));
          }
          if (!localDealOfTheDay && fallbackDeals[0]) {
            const best = fallbackDeals[0];
            localDealOfTheDay = {
              id: best.id,
              title: best.title,
              href: `/deals/${best.id}`,
              image: best.image,
              temperature: best.temperature,
              price: best.price,
              description: best.description,
            };
          }
        }

        if (!mounted) return;
        setPromotedItems(localPromoted.slice(0, 3));
        setDealOfTheDay(localDealOfTheDay);
      } catch (error) {
        console.error("Nie udało się pobrać danych mega menu", error);
        if (!mounted) return;
        setCategories([]);
        setPromotedItems([]);
        setDealOfTheDay(null);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const categoriesCount = categories.length;

  React.useEffect(() => {
    if (categoriesCount === 0 && activeIndex !== 0) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= categoriesCount && categoriesCount > 0) {
      setActiveIndex(0);
    }
  }, [categoriesCount, activeIndex]);

  const activeCategory = categories[activeIndex] ?? null;
  const dealOfTheDayPrice = formatCurrency(dealOfTheDay?.price);

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className={navigationMenuTriggerStyle()}>
        Katalog
      </NavigationMenuTrigger>
  <NavigationMenuContent className="w-screen max-w-none border-t border-border/60 bg-background/95 shadow-lg backdrop-blur animate-fade">
        {isLoading ? (
          <div className="grid gap-6 px-4 py-8 md:grid-cols-[minmax(220px,1fr)_minmax(520px,2.5fr)_minmax(260px,1.2fr)] md:px-12">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : categories.length === 0 ? (
          <div className="flex items-center justify-center px-6 py-16 text-sm text-muted-foreground">
            Brak zdefiniowanych kategorii. Dodaj je w panelu administracyjnym.
          </div>
        ) : (
          <div className="grid gap-6 px-4 py-8 md:grid-cols-[minmax(220px,1fr)_minmax(520px,2.5fr)_minmax(260px,1.2fr)] md:px-12">
            <ScrollArea className="max-h-[70vh] pr-2">
              <nav className="space-y-2" aria-label="Kategorie">
                {categories.map((category, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onFocus={() => setActiveIndex(index)}
                      aria-selected={isActive}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent bg-card/70 hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        {category.icon ? (
                          <span className="text-lg" aria-hidden>
                            {category.icon}
                          </span>
                        ) : (
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{category.name}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 opacity-70" />
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>

            <div className="flex flex-col gap-6">
              <div className="space-y-2">
                <nav className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Link href="/" className="transition-colors hover:text-primary">
                    Strona główna
                  </Link>
                  <span className="opacity-60">/</span>
                  {activeCategory ? (
                    <span className="text-primary">{activeCategory.name}</span>
                  ) : (
                    <span>Kategorie</span>
                  )}
                </nav>
                {activeCategory?.description && (
                  <p className="text-sm text-muted-foreground">{activeCategory.description}</p>
                )}
              </div>

              {activeCategory?.heroImage ? (
                <Link
                  href={`/products?mainCategory=${encodeURIComponent(activeCategory.slug ?? activeCategory.id)}`}
                  className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm"
                >
                  <Image
                    src={activeCategory.heroImage}
                    alt={activeCategory.name}
                    width={960}
                    height={320}
                    className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-background/10" />
                  <div className="absolute inset-0 flex flex-col justify-end gap-2 p-6">
                    <Badge className="w-fit bg-background/80 text-xs uppercase text-muted-foreground" variant="secondary">
                      Kolekcja
                    </Badge>
                    <h3 className="text-xl font-semibold text-foreground">{activeCategory.name}</h3>
                    {activeCategory.description && (
                      <p className="max-w-xl text-sm text-muted-foreground">
                        {activeCategory.description}
                      </p>
                    )}
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                      Zobacz wszystkie <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ) : null}

              {activeCategory?.subcategories?.length ? (
                <div className="space-y-6">
                  {activeCategory.subcategories.map((subcategory) => {
                    const targetCategory = encodeURIComponent(activeCategory.slug ?? activeCategory.id);
                    const subKey = subcategory.slug ?? subcategory.id ?? subcategory.name;
                    const rawSub = subcategory.slug ?? subcategory.id;
                    const targetSub = rawSub ? encodeURIComponent(rawSub) : null;
                    
                    // Link do podkategorii - ZAWSZE kierujemy na /products (nie /deals)
                    // Deals nie używają mega menu do nawigacji podkategorii (tylko lewy panel)
                    const href = targetSub
                      ? `/products?mainCategory=${targetCategory}&subCategory=${targetSub}`
                      : `/products?mainCategory=${targetCategory}`;
                    
                    // Sprawdź czy ma sub-subkategorie
                    const hasSubSubcategories = subcategory.subcategories && subcategory.subcategories.length > 0;
                    
                    return (
                      <div key={`${activeCategory.id}-${subKey}`} className="space-y-3">
                        {/* Nagłówek podkategorii */}
                        <Link
                          href={href}
                          className="group flex items-center gap-3 rounded-lg border border-border/40 bg-card/80 p-4 shadow-sm transition-all hover:border-primary hover:bg-card"
                        >
                          {subcategory.image ? (
                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                              <Image
                                src={subcategory.image}
                                alt={subcategory.name}
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-110"
                              />
                            </div>
                          ) : (
                            <div className="h-16 w-16 flex-shrink-0 rounded-md bg-muted" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-foreground truncate">
                                {subcategory.name}
                              </h4>
                              {subcategory.highlight && (
                                <Badge className="text-[10px] uppercase flex-shrink-0" variant="secondary">
                                  Polecane
                                </Badge>
                              )}
                            </div>
                            {subcategory.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {subcategory.description}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                        </Link>

                        {/* Sub-subkategorie (jeśli istnieją) */}
                        {hasSubSubcategories && (
                          <div className="grid gap-2 pl-6 md:grid-cols-2 lg:grid-cols-3">
                            {subcategory.subcategories!.map((subSubcategory) => {
                              const subSubSlug = subSubcategory.slug ?? subSubcategory.id;
                              const subSubHref = subSubSlug && targetSub
                                ? `/products?mainCategory=${targetCategory}&subCategory=${targetSub}&subSubCategory=${encodeURIComponent(subSubSlug)}`
                                : href;
                              
                              return (
                                <Link
                                  key={`${subKey}-${subSubcategory.slug}`}
                                  href={subSubHref}
                                  className="group flex items-center gap-2 rounded-md border border-border/30 bg-background/50 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                                >
                                  {subSubcategory.icon && (
                                    <span className="text-base">{subSubcategory.icon}</span>
                                  )}
                                  <span className="flex-1 truncate text-foreground group-hover:text-primary">
                                    {subSubcategory.name}
                                  </span>
                                  <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                  Brak podkategorii w tej kategorii.
                </div>
              )}

              {activeCategory?.promo ? (
                <Link
                  href={activeCategory.promo.link ?? "/deals"}
                  className="group relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-r from-background via-background/70 to-background/40 p-[1px]"
                >
                  <div className="flex flex-col gap-4 overflow-hidden rounded-[0.95rem] bg-card/90 p-5 md:flex-row">
                    <div className="flex-1 space-y-2">
                      {activeCategory.promo.badge ? (
                        <Badge className="w-fit" style={{ backgroundColor: activeCategory.promo.color ?? undefined }}>
                          {activeCategory.promo.badge}
                        </Badge>
                      ) : null}
                      <h3 className="text-lg font-semibold leading-tight text-foreground">
                        {activeCategory.promo.title}
                      </h3>
                      {activeCategory.promo.subtitle ? (
                        <p className="text-sm font-medium text-primary/80">
                          {activeCategory.promo.subtitle}
                        </p>
                      ) : null}
                      {activeCategory.promo.description ? (
                        <p className="text-sm text-muted-foreground">
                          {activeCategory.promo.description}
                        </p>
                      ) : null}
                      <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        {activeCategory.promo.cta ?? "Zobacz więcej"}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                    {activeCategory.promo.image ? (
                      <div className="relative h-40 w-full max-w-xs overflow-hidden rounded-xl">
                        <Image
                          src={activeCategory.promo.image}
                          alt={activeCategory.promo.title}
                          fill
                          sizes="(max-width: 768px) 60vw, 240px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : null}
                  </div>
                </Link>
              ) : null}
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-xl border border-border/60 bg-card/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Twoje konto</p>
                {authLoading ? (
                  <div className="mt-3 space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ) : user ? (
                  <div className="mt-3 space-y-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {user.photoURL ? (
                          <AvatarImage src={user.photoURL} alt={user.displayName ?? "Użytkownik"} />
                        ) : null}
                        <AvatarFallback>{(user.displayName ?? user.email ?? "U").charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground">
                          {user.displayName ?? "Użytkownik"}
                        </p>
                        {user.email ? (
                          <p className="text-xs text-muted-foreground line-clamp-1">{user.email}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Link href="/profile" className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
                        <span className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> Profil</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      <Link href="/profile?tab=favorites" className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
                        <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Ulubione</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      <Link href="/profile?tab=notifications" className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary">
                        <span className="flex items-center gap-2"><Flame className="h-4 w-4" /> Powiadomienia</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                      {user.role === "admin" ? (
                        <Link
                          href="/admin"
                          className="flex items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-primary"
                        >
                          <span className="flex items-center gap-2">
                            <LayoutDashboard className="h-4 w-4" /> Panel admina
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={logout}
                        className="flex w-full items-center justify-between rounded-md border border-border/40 bg-background/70 px-3 py-2 text-sm transition-colors hover:border-destructive/60 hover:text-destructive"
                      >
                        <span className="flex items-center gap-2">
                          <LogOut className="h-4 w-4" /> Wyloguj się
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Zaloguj się, aby zapisywać okazje i śledzić ulubione kategorie.
                    </p>
                    <Button asChild className="w-full">
                      <Link href="/login" className="flex items-center justify-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        Zaloguj się
                      </Link>
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Polecane teraz
                </p>
                <div className="space-y-3">
                  {promotedItems.length ? (
                    promotedItems.map((item) => {
                      const formatted = formatCurrency(item.price);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/80 p-3 transition-colors hover:border-primary"
                        >
                          <div className="h-16 w-16 overflow-hidden rounded-md bg-muted">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.title}
                                width={64}
                                height={64}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground line-clamp-2">
                              {item.title}
                            </p>
                            {formatted ? (
                              <p className="text-sm font-bold text-primary">{formatted}</p>
                            ) : null}
                            {item.meta ? (
                              <p className="text-xs text-muted-foreground">{item.meta}</p>
                            ) : null}
                          </div>
                        </Link>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
                      Brak wyróżnionych pozycji.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Deal dnia
                </p>
                {dealOfTheDay ? (
                  <Link href={dealOfTheDay.href} className="block">
                    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-sm">
                      {dealOfTheDay.image ? (
                        <Image
                          src={dealOfTheDay.image}
                          alt={dealOfTheDay.title}
                          width={280}
                          height={160}
                          className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : null}
                      <div className="space-y-2 p-4">
                        <p className="text-sm font-semibold leading-tight line-clamp-2">
                          {dealOfTheDay.title}
                        </p>
                        {dealOfTheDay.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {dealOfTheDay.description}
                          </p>
                        ) : null}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          {dealOfTheDayPrice ? (
                            <span className="font-semibold text-primary">{dealOfTheDayPrice}</span>
                          ) : null}
                          <span className="flex items-center gap-1 font-medium text-amber-500">
                            <Flame className="h-3.5 w-3.5" />
                            {dealOfTheDay.temperature} pkt
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 p-4 text-xs text-muted-foreground">
                    Deal dnia pojawi się wkrótce.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
