'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Layout, Flame, ShoppingBag, Eye, LogOut, List, Newspaper, Moon, LayoutGrid, Grid2X2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function PreviewHeader() {
  const pathname = usePathname();
  const locale = useLocale();
  const [showVersions, setShowVersions] = useState(false);

  const mainLinks = [
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

  const versionLinks = [
    { href: `/${locale}/admin/ux-preview`, label: 'V0 — Home (obecna)', icon: Layout, desc: 'Hero + karty okazji' },
    { href: `/${locale}/admin/ux-preview/v1`, label: 'V1 — Lista + sidebar', icon: List, desc: 'Filtr boczny, widok listy' },
    { href: `/${locale}/admin/ux-preview/v2`, label: 'V2 — Magazyn', icon: Newspaper, desc: 'Hero deal, magazynowy grid' },
    { href: `/${locale}/admin/ux-preview/v3`, label: 'V3 — Dark Neon', icon: Moon, desc: 'Ciemny motyw, neonowe akcenty' },
    { href: `/${locale}/admin/ux-preview/v4`, label: 'V4 — Masonry/Kafelki', icon: LayoutGrid, desc: 'Kafelki, przełącznik widoku' },
    { href: `/${locale}/admin/ux-preview/v5`, label: 'V5 — Kategorie', icon: Grid2X2, desc: 'Nawigacja przez kategorie' },
  ];

  const isVersionActive = versionLinks.some(v => pathname === v.href);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/40 shadow-sm">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center justify-center bg-primary/10 text-primary h-8 w-8 rounded-lg">
            <Eye className="h-4 w-4 animate-pulse" />
          </div>
          <span className="font-extrabold text-sm tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent hidden sm:inline-block">
            UX REDESIGN SHOWCASE
          </span>
          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Admin Preview
          </span>
        </div>

        {/* Links */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto flex-1 justify-center">
          {mainLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}

          {/* Versions dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                isVersionActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Propozycje UX</span>
              <ChevronDown className={cn("h-3 w-3 transition-transform", showVersions && "rotate-180")} />
            </button>

            {showVersions && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setShowVersions(false)} />
                {/* Dropdown */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-background border border-border/40 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="p-2 space-y-1">
                    {versionLinks.map((v) => {
                      const isActive = pathname === v.href;
                      const Icon = v.icon;
                      return (
                        <Link
                          key={v.href}
                          href={v.href}
                          onClick={() => setShowVersions(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-bold truncate", isActive && "text-primary")}>{v.label}</p>
                            <p className="text-[10px] text-muted-foreground">{v.desc}</p>
                          </div>
                          {isActive && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </nav>

        {/* Exit Preview */}
        <div className="flex-shrink-0">
          <Link
            href={`/${locale}/`}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Wyjdź</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
