'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Category } from '@/lib/types';
import { getCategoryStyle } from '@/lib/category-theme';
import { getLocalizedCategoryName, type SupportedLanguage } from '@/lib/i18n-utils';
import { buildCategoryPath } from '@/lib/category-routes';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubNavbarProps {
  categories: Category[];
}

export function SubNavbar({ categories }: SubNavbarProps) {
  const tNav = useTranslations('nav');
  const rawLocale = useLocale();
  const pathname = usePathname();
  const locale = (rawLocale as SupportedLanguage) || 'pl';
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 240;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (!categories || categories.length === 0) return null;

  return (
    <div className="w-full bg-background border-b border-border/40 relative z-30">
      <div className="page-container relative flex items-center group/subnav py-1 px-4">
        {/* Left Arrow Button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-2 p-1.5 rounded-full bg-background/80 border border-border/40 text-foreground shadow-sm hover:bg-background opacity-0 group-hover/subnav:opacity-100 transition-opacity duration-200 focus:opacity-100 z-10 hidden sm:block"
          aria-label="Przewiń w lewo"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto flex items-center gap-2 sm:gap-4 no-scrollbar scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* "All Deals" or "Categories" label / chips if needed */}
          <Link
            href={`/${locale}/deals`}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap shrink-0",
              pathname === `/${locale}/deals` || pathname === `/deals`
                ? "bg-primary border-primary text-primary-foreground shadow-sm"
                : "bg-background hover:bg-muted border-border/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {tNav.has && tNav.has('allDeals') ? tNav('allDeals') : '🔥 Wszystkie okazje'}
          </Link>

          {categories.map((category) => {
            const style = getCategoryStyle(category);
            const IconComponent = style.icon;
            const path = buildCategoryPath(locale, category.slug || category.id || '');
            const isActive = pathname.startsWith(path);

            return (
              <Link
                key={category.id || category.slug}
                href={path}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap shrink-0 group",
                  isActive
                    ? cn("bg-gradient-to-br text-white shadow-sm border-transparent", style.gradient)
                    : "bg-background hover:bg-muted border-border/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "h-5 w-5 rounded-md flex items-center justify-center transition-all bg-gradient-to-br shadow-sm",
                    isActive ? "bg-white/20 text-white" : cn(style.bg, style.accent)
                  )}
                >
                  {typeof IconComponent === 'function' ? (
                    <IconComponent className="h-3.5 w-3.5" />
                  ) : (
                    <span className="text-xs">{IconComponent}</span>
                  )}
                </div>
                <span>{getLocalizedCategoryName(category, locale as SupportedLanguage)}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Arrow Button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-2 p-1.5 rounded-full bg-background/80 border border-border/40 text-foreground shadow-sm hover:bg-background opacity-0 group-hover/subnav:opacity-100 transition-opacity duration-200 focus:opacity-100 z-10 hidden sm:block"
          aria-label="Przewiń w prawo"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
