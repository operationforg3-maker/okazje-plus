"use client";

import React from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import { Menu, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { LanguageSwitcherMenu } from '@/components/locale-currency-switcher';
import { CurrencySwitcher } from '@/components/currency-switcher';

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const { user, loading } = useAuth();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile Nav */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon" className="rounded-full border-border/60 bg-card/80">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Otwórz menu</span>
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
                <Link href={`${prefix}/`} onClick={() => setIsOpen(false)}>Strona główna</Link>
                <Link href={`${prefix}/deals`} onClick={() => setIsOpen(false)}>Okazje</Link>
                <Link href={`${prefix}/products`} onClick={() => setIsOpen(false)}>Produkty</Link>
                <Link href={`${prefix}/forum`} onClick={() => setIsOpen(false)}>Forum</Link>
                <Link href={`${prefix}/add-deal`} onClick={() => setIsOpen(false)} className="text-primary">Dodaj okazję</Link>
              </div>
            </SheetContent>
          </Sheet>

          {/* Brand */}
          <Link href={`${prefix}/`} className="flex items-center gap-2">
            <img
              src="/icon_okazjeplus.svg"
              alt="Okazje+"
              className="h-8 w-8 flex-shrink-0 md:hidden"
            />
            <img
              src="/Logotyp_okazjeplus.svg"
              alt="Okazje+"
              className="hidden h-8 flex-shrink-0 md:block md:h-9 lg:h-10"
            />
          </Link>

          {/* Desktop Nav */}
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList className="gap-2">
              <NavigationMenuItem>
                <Link href={`${prefix}/deals`} passHref>
                  <NavigationMenuLink className={`${navigationMenuTriggerStyle()} rounded-full px-4 py-2`}>Okazje</NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href={`${prefix}/products`} passHref>
                  <NavigationMenuLink className={`${navigationMenuTriggerStyle()} rounded-full px-4 py-2`}>Produkty</NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href={`${prefix}/forum`} passHref>
                  <NavigationMenuLink className={`${navigationMenuTriggerStyle()} rounded-full px-4 py-2`}>Forum</NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

          <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
            <div className="hidden max-w-xl flex-1 sm:block">
              <AutocompleteSearch />
            </div>
            <LanguageSwitcherMenu />
            <CurrencySwitcher />
            <Link href={`${prefix}/add-deal`} className="hidden lg:inline-flex">
              <Button className="rounded-full bg-primary px-4 shadow-lg shadow-primary/20">Dodaj okazję</Button>
            </Link>
            <Link href={`${prefix}/cart`} className="relative">
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <ShoppingBag className="h-5 w-5" />
                <MiniCartBadge />
              </Button>
            </Link>
            {!isMounted || loading ? (
              <Skeleton className="h-9 w-9 rounded-full" />
            ) : user ? (
              <UserNav />
            ) : (
              <Link href={`${prefix}/login`}>
                <Button variant="outline" className="rounded-full">Zaloguj się</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Secondary quick links (mobile-friendly scroll) */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs text-muted-foreground">
          <span className="rounded-full bg-card/80 px-3 py-1 font-medium text-foreground/80">Sezonowe hity</span>
          <Link href={`${prefix}/deals?sort=hot`} className="rounded-full border border-border/50 bg-card/60 px-3 py-1 transition-colors hover:border-primary hover:text-primary">Najgorętsze</Link>
          <Link href={`${prefix}/deals?sort=new`} className="rounded-full border border-border/50 bg-card/60 px-3 py-1 transition-colors hover:border-primary hover:text-primary">Najnowsze</Link>
          <Link href={`${prefix}/products?sort=trending`} className="rounded-full border border-border/50 bg-card/60 px-3 py-1 transition-colors hover:border-primary hover:text-primary">Trendy</Link>
          <Link href={`${prefix}/forum`} className="rounded-full border border-border/50 bg-card/60 px-3 py-1 transition-colors hover:border-primary hover:text-primary">Forum</Link>
        </div>
      </div>
    </header>
  );
}
