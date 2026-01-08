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

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);
  const { user, loading } = useAuth();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

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
            <div className="flex items-center justify-center">
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
            </div>
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
            {/* Language, Currency, Theme moved to AccountMenuPanel */}
            {/* PRIMARY CTA: Add Deal - Now visible on md+ screens */}
            <Button asChild className="hidden md:inline-flex rounded-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transition-all">
              <Link href={`${prefix}/add-deal`}>
                + Dodaj Okazję
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="relative rounded-full" asChild>
              <Link href={`${prefix}/cart`}>
                <ShoppingBag className="h-5 w-5" />
                <MiniCartBadge />
              </Link>
            </Button>
            {!isMounted ? (
              <Skeleton className="h-9 w-9 rounded-full" />
            ) : (
              <UserNav />
            )}
          </div>
        </div>

        {/* Secondary quick links (mobile-friendly scroll) */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs text-muted-foreground">
          <span className="rounded-full px-3 py-1 font-medium text-foreground/70">Sezonowe hity</span>
          <Link href={`${prefix}/deals?sort=hot`} className="rounded-full px-3 py-1 transition-colors hover:text-primary">Najgorętsze</Link>
          <Link href={`${prefix}/deals?sort=new`} className="rounded-full px-3 py-1 transition-colors hover:text-primary">Najnowsze</Link>
          <Link href={`${prefix}/products?sort=trending`} className="rounded-full px-3 py-1 transition-colors hover:text-primary">Trendy</Link>
          <Link href={`${prefix}/forum`} className="rounded-full px-3 py-1 transition-colors hover:text-primary">Forum</Link>
        </div>
      </div>
    </header>
  );
}
