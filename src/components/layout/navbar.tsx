'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import { Menu, Search, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { MegaMenu } from '@/components/layout/mega-menu';
import { AutocompleteSearch } from '@/components/autocomplete-search';
import { NotificationBell } from '@/components/notification-bell';
import { LanguageSwitcher } from '@/components/language-switcher';

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const router = useRouter();
  const { user, loading } = useAuth();

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchQuery = formData.get('search') as string;
    router.push(`/search?q=${searchQuery}`);
  };

  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center gap-4">
        {/* Mobile Nav */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Otwórz menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>
                <Link href={`${prefix}/`} className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
                  <ShoppingBag className="h-6 w-6 text-primary" />
                  <span className="font-bold font-headline text-xl">Okazje+</span>
                </Link>
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col space-y-4 py-6">
              <Link href={`${prefix}/`} className="text-lg font-medium" onClick={() => setIsOpen(false)}>Strona główna</Link>
              <Link href={`${prefix}/deals`} className="text-lg font-medium" onClick={() => setIsOpen(false)}>Okazje</Link>
              <Link href={`${prefix}/products`} className="text-lg font-medium" onClick={() => setIsOpen(false)}>Katalog</Link>
              <Link href={`${prefix}/forum`} className="text-lg font-medium" onClick={() => setIsOpen(false)}>Forum</Link>
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Desktop Nav */}
  <Link href={`${prefix}/`} className="mr-6 hidden items-center space-x-2 md:flex">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <span className="hidden font-bold font-headline sm:inline-block text-lg">
            Okazje+
          </span>
        </Link>
        
        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href={`${prefix}/`} legacyBehavior passHref>
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                  Strona główna
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href={`${prefix}/deals`} legacyBehavior passHref>
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                  Okazje
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href={`${prefix}/forum`} legacyBehavior passHref>
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                  Forum
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <MegaMenu />
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <div className="flex-1 max-w-md ml-auto">
            <AutocompleteSearch />
          </div>
          <LanguageSwitcher />
          {loading ? (
              <Skeleton className="h-9 w-9 rounded-full" />
            ) : user ? (
              <UserNav />
            ) : (
              <Link href={`${prefix}/login`}>
                <Button variant="outline">Zaloguj się</Button>
              </Link>
            )}
        </div>
      </div>
    </header>
  );
}
