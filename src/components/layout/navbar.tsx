"use client";

import React from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import { Menu, ShoppingBag, Scale, Trash2 } from 'lucide-react';
import { useComparison } from '@/components/deal-comparison-tool';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { UserNav } from '@/components/auth/user-nav';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { AutocompleteSearch } from '@/components/autocomplete-search';
import { MiniCartBadge } from '@/components/smart-cart-widget';
import { LogoSVGWrapper } from './logo-svg-wrapper';
import { useSmartCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/unified-currency';
import { getPriceAmount, getTotalPrice, isFreeShipping } from '@/lib/i18n-utils';
import Image from 'next/image';

export function Navbar() {
  const t = useTranslations('nav');
  const [isOpen, setIsOpen] = React.useState(false);
  const [cartMenuOpen, setCartMenuOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const { user, loading } = useAuth();
  const { addToComparison } = useComparison();
  const cartMenuRef = React.useRef<HTMLDivElement>(null);
  const { items, itemCount, totalAmount, totalWithShipping, removeItem } = useSmartCart();
  const { formatPrice } = useCurrency();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close cart menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cartMenuRef.current && !cartMenuRef.current.contains(event.target as Node)) {
        setCartMenuOpen(false);
      }
    };

    if (cartMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [cartMenuOpen]);

  // Debug log
  React.useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log('[Navbar] Auth state:', { 
        user: !!user, 
        loading, 
        isMounted, 
        email: user?.email,
        role: user?.role,
        userObj: user ? JSON.stringify(user) : 'null'
      });
    }
  }, [user, loading, isMounted]);

  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="page-container flex flex-col gap-3 py-3">
        <div className="flex items-center gap-3">
          {/* Mobile Nav */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="h-5 w-5" />
                <span className="sr-only">{t('openMenu')}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-background/95">
              <SheetHeader>
                <SheetTitle>
                  <Link href={`${prefix}/`} className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
                    <img src="/icon_okazjeplus.svg" alt="Okazje+ logo" className="h-8 w-8" />
                    <span className="font-bold font-headline text-xl">Okazje+</span>
                  </Link>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col space-y-4 py-6 text-lg font-medium">
                <Link href={`${prefix}/`} onClick={() => setIsOpen(false)}>{t('home')}</Link>
                <Link href={`${prefix}/deals`} onClick={() => setIsOpen(false)}>{t('deals')}</Link>
                <Link href={`${prefix}/products`} onClick={() => setIsOpen(false)}>{t('products')}</Link>
                <Link href={`${prefix}/forum`} onClick={() => setIsOpen(false)}>{t('forum')}</Link>
                <Link href={`${prefix}/add-deal`} onClick={() => setIsOpen(false)} className="text-primary">{t('addDeal')}</Link>
              </div>
            </SheetContent>
          </Sheet>

          {/* Brand */}
          <Link href={`${prefix}/`} className="flex items-center gap-2">
            <div className="flex items-center justify-center">
              <img
                src="/icon_okazjeplus.svg"
                alt="Okazje+"
                className="h-8 w-8 flex-shrink-0 md:hidden"
              />
              <LogoSVGWrapper className="hidden h-8 flex-shrink-0 md:block md:h-9 lg:h-10" />
            </div>
          </Link>

          {/* Desktop Nav */}
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList className="gap-2">
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} rounded-full px-4 py-2`}>
                  <Link href={`${prefix}/deals`}>{t('deals')}</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} rounded-full px-4 py-2`}>
                  <Link href={`${prefix}/products`}>{t('products')}</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuLink asChild className={`${navigationMenuTriggerStyle()} rounded-full px-4 py-2`}>
                  <Link href={`${prefix}/forum`}>{t('forum')}</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
            <div className="hidden max-w-xl flex-1 sm:block">
              <AutocompleteSearch />
            </div>
            {/* Language, Currency, Theme moved to AccountMenuPanel */}
            {/* PRIMARY CTA: Add Deal - Now visible on md+ screens */}
            <Button asChild className="hidden md:inline-flex rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all">
              <Link href={`${prefix}/add-deal`}>
                + {t('addDeal')}
              </Link>
            </Button>
            {/* Cart & Comparison Menu */}
            <div className="relative" ref={cartMenuRef}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="relative rounded-full"
                onClick={() => setCartMenuOpen(!cartMenuOpen)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setCartMenuOpen(false);
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setCartMenuOpen(!cartMenuOpen);
                  }
                }}
                data-testid="cart-button"
                aria-label={cartMenuOpen ? 'Zamknij koszyk' : 'Otwórz koszyk'}
                aria-expanded={cartMenuOpen}
                aria-haspopup="dialog"
              >
                <ShoppingBag className="h-5 w-5" />
                <MiniCartBadge />
              </Button>

              {cartMenuOpen && isMounted && (
                <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50" role="dialog" aria-labelledby="cart-title" aria-modal="true">
                  <div className="p-4">
                    <h3 id="cart-title" className="font-semibold text-lg mb-3">Twoje zakupy</h3>
                    
                    {/* Cart Preview */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Koszyk</span>
                        <span className="text-xs">{itemCount} szt.</span>
                      </div>
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Twój koszyk jest pusty.</p>
                      ) : (
                        <div className="space-y-3">
                          {items.slice(0, 3).map((item) => {
                            const priceSource = item.product ? item.product.price : item.deal?.price;
                            const price = getPriceAmount(priceSource);
                            const total = getTotalPrice(priceSource);
                            const shippingCost = Math.max((total ?? 0) - (price ?? 0), 0);
                            const title = item.product
                              ? ((item.product as any).title?.pl || (item.product as any).name || 'Produkt')
                              : ((item.deal as any)?.title?.pl || (item.deal as any)?.title || 'Okazja');
                            const imageUrl = item.product
                              ? ((item.product as any).image || (item.product as any).imageUrl || '/placeholder.png')
                              : (((item.deal as any)?.image || (item.deal as any)?.imageUrl) || '/placeholder.png');
                            const freeShip = isFreeShipping(priceSource);
                            const keyId = (item.product as any)?.id ?? (item.deal as any)?.id;
                            return (
                              <div key={keyId} className="flex items-center gap-3">
                                <div className="relative h-12 w-12 flex-shrink-0">
                                  <Image src={imageUrl} alt={title} fill sizes="48px" className="object-cover rounded" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{title}</p>
                                  <p className="text-xs text-muted-foreground">Ilość: {item.quantity}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-semibold">{formatPrice(price)}</span>
                                    {freeShip ? (
                                      <span className="text-xs text-green-600">Darmowa wysyłka</span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">+ wysyłka {formatPrice(shippingCost)}</span>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => removeItem(((item.product as any)?.id ?? (item.deal as any)?.id))}
                                  aria-label={`Usuń ${title} z koszyka`}
                                  title={`Usuń ${title}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                          {items.length > 3 && (
                            <p className="text-xs text-muted-foreground">+ {items.length - 3} więcej pozycji</p>
                          )}
                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Suma:</span>
                              <span className="font-semibold">{Number.isFinite(totalWithShipping) ? formatPrice(totalWithShipping) : '—'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Link
                          href={`${prefix}/cart`}
                          className="flex-1 text-center py-2 px-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                          onClick={() => setCartMenuOpen(false)}
                        >
                          Przejdź do koszyka
                        </Link>
                        <Button variant="outline" className="px-3" onClick={() => setCartMenuOpen(false)}>
                          Zamknij
                        </Button>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      {/* Comparison Toggle - disabled for now */}
                      {/* 
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Porównywarka</span>
                        </div>
                        <span className="text-sm font-medium">0</span>
                      </div>
                      <button
                        onClick={() => {
                          const event = new CustomEvent('toggleComparison');
                          window.dispatchEvent(event);
                          setCartMenuOpen(false);
                        }}
                        className="block w-full text-center py-2 px-4 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                        disabled={true}
                      >
                        Brak produktów
                      </button>
                      */}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {!isMounted ? (
              <Skeleton className="h-9 w-9 rounded-full" />
            ) : (
              <UserNav />
            )}
          </div>
        </div>

        {/* Secondary quick links (mobile-friendly scroll) */}
        <nav className="flex items-center gap-2 overflow-x-auto text-xs text-muted-foreground" aria-label="Szybkie linki">
          <span className="rounded-full px-3 py-1 font-medium text-foreground/70" role="status">{t('seasonalHits')}</span>
          <Link href={`${prefix}/deals?sort=hot`} className="rounded-full px-3 py-1 transition-colors hover:text-primary" title="Gorące okazje">{t('hottest')}</Link>
          <Link href={`${prefix}/deals?sort=new`} className="rounded-full px-3 py-1 transition-colors hover:text-primary" title="Nowe okazje">{t('newest')}</Link>
          <Link href={`${prefix}/products?sort=trending`} className="rounded-full px-3 py-1 transition-colors hover:text-primary" title="Popularne produkty">{t('trending')}</Link>
          <Link href={`${prefix}/forum`} className="rounded-full px-3 py-1 transition-colors hover:text-primary" title="Forum społeczności">{t('forum')}</Link>
        </nav>
      </div>
    </header>
  );
}
