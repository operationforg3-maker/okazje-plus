'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Layout, Flame, ShoppingBag, Eye, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PreviewHeader() {
  const pathname = usePathname();
  const locale = useLocale();

  const links = [
    {
      href: `/${locale}/admin/ux-preview`,
      label: 'Home Redesign',
      icon: Layout,
    },
    {
      href: `/${locale}/admin/ux-preview/deals`,
      label: 'Gorące Okazje',
      icon: Flame,
    },
    {
      href: `/${locale}/admin/ux-preview/products`,
      label: 'Lista Produktów',
      icon: ShoppingBag,
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/40 shadow-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center bg-primary/10 text-primary h-8 w-8 rounded-lg">
            <Eye className="h-4.5 w-4.5 animate-pulse" />
          </div>
          <span className="font-extrabold text-sm tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent hidden sm:inline-block">
            UX REDESIGN SHOWCASE
          </span>
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Admin Preview
          </span>
        </div>

        {/* Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Exit Preview */}
        <div>
          <Link
            href={`/${locale}/`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Wyjdź z podglądu</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
