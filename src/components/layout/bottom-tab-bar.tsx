"use client";

import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { Home, Hourglass, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type BottomNavItem = {
  key: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: (pathname: string, searchParams: URLSearchParams) => boolean;
};

export function BottomTabBar() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;

  const items: BottomNavItem[] = [
    {
      key: 'home',
      href: `${prefix}`,
      label: 'Główna',
      icon: Home,
      isActive: (p) => p === `${prefix}` || p === `${prefix}/`,
    },
    {
      key: 'waiting-room',
      href: `${prefix}/deals?status=waiting_room`,
      label: 'Poczekalnia',
      icon: Hourglass,
      isActive: (p, sp) => p === `${prefix}/deals` && sp.get('status') === 'waiting_room',
    },
    {
      key: 'search',
      href: `${prefix}/search`,
      label: 'Szukaj',
      icon: Search,
      isActive: (p) => p === `${prefix}/search`,
    },
    {
      key: 'account',
      href: `${prefix}/profile`,
      label: 'Konto',
      icon: User,
      isActive: (p) => p === `${prefix}/profile` || p.startsWith(`${prefix}/profile/`),
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
      aria-label="Nawigacja mobilna"
    >
      <ul className="mx-auto grid h-16 max-w-screen-sm grid-cols-4 px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive
            ? item.isActive(pathname, searchParams)
            : pathname === item.href;

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground active:scale-[0.98]'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', active && 'text-primary')} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
