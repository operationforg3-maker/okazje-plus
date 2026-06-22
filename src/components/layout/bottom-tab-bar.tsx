"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { Home, Hourglass, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { MobileSearchModule } from '@/components/layout/mobile-search-module';
import { useTranslations } from 'next-intl';

type BottomNavItem = {
  key: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: (pathname: string, searchParams: URLSearchParams) => boolean;
};

export function BottomTabBar() {
  const t = useTranslations('nav');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;

  const items: BottomNavItem[] = [
    {
      key: 'home',
      href: `${prefix}`,
      label: t('home'),
      icon: Home,
      isActive: (p) => p === `${prefix}` || p === `${prefix}/`,
    },
    {
      key: 'waiting-room',
      href: `${prefix}/deals?status=waiting_room`,
      label: t('waitingRoom'),
      icon: Hourglass,
      isActive: (p, sp) => p === `${prefix}/deals` && sp.get('status') === 'waiting_room',
    },
    {
      key: 'search',
      href: '#',
      label: t('search'),
      icon: Search,
      isActive: (p) => p === `${prefix}/search` || isSearchOpen,
    },
    {
      key: 'account',
      href: `${prefix}/profile`,
      label: t('account'),
      icon: User,
      isActive: (p) => p === `${prefix}/profile` || p.startsWith(`${prefix}/profile/`),
    },
  ];

  return (
    <>
      <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <SheetContent side="bottom" className="md:hidden h-[78vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{t('search')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <MobileSearchModule prefix={prefix} onNavigate={() => setIsSearchOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
        aria-label={t('mobileNavigation')}
      >
        <ul className="mx-auto grid h-16 max-w-screen-sm grid-cols-4 px-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.isActive
              ? item.isActive(pathname, searchParams)
              : pathname === item.href;

            return (
              <li key={item.key}>
                {item.key === 'search' ? (
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(true)}
                    className={cn(
                      'flex h-full w-full flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors',
                      active
                        ? 'text-primary font-bold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:text-foreground active:scale-[0.98]'
                    )}
                    aria-current={active ? 'page' : undefined}
                    aria-label={t('openSearch')}
                  >
                    <Icon className={cn('h-5 w-5', active && 'text-primary')} />
                    <span>{item.label}</span>
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-full flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors',
                      active
                        ? 'text-primary font-bold'
                        : 'text-zinc-700 dark:text-zinc-300 hover:text-foreground active:scale-[0.98]'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon className={cn('h-5 w-5', active && 'text-primary')} />
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
