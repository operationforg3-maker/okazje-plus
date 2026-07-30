'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Category } from '@/lib/types';
import { buildCategoryPath } from '@/lib/category-routes';
import { ChevronRight, Grid3x3, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { getLocalizedCategoryName, SupportedLanguage } from '@/lib/i18n-utils';
import { getCategoryStyle } from '@/lib/category-theme';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface CategoryGridProps {
  categories: Category[];
}

export default function CategoryGrid({ categories }: CategoryGridProps) {
  const t = useTranslations('home.browseCategories');
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const rawLocale = useLocale();
  const locale = (rawLocale as SupportedLanguage) || 'pl';

  // Count total products in category (including all subcategories)
  const getTotalProducts = (category: Category) => {
    let total = (category as any).productCount || 0;
    category.subcategories?.forEach(sub => {
      total += (sub as any).productCount || 0;
      sub.subcategories?.forEach(subsub => {
        total += (subsub as any).productCount || 0;
      });
    });
    return total;
  };

  const handleOpenDrawer = (category: Category) => {
    setActiveCategory(category);
    setIsDrawerOpen(true);
  };

  return (
    <div className="w-full space-y-8">
      {/* Main Grid View - Top Level Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {categories.map((category) => {
          const style = getCategoryStyle(category);
          const totalProducts = getTotalProducts(category);
          const IconComponent = style.icon;

          return (
            <button
              key={category.id}
              onClick={() => handleOpenDrawer(category)}
              className="w-full flex items-center gap-3 p-3 ux-card-container text-left group cursor-pointer"
            >
              <div className={cn(
                "h-10 w-10 ux-icon-box flex items-center justify-center flex-shrink-0 bg-gradient-to-br shadow-sm group-hover:shadow-md",
                style.bg,
                style.accent
              )}>
                {typeof IconComponent === 'function' ? (
                  <IconComponent className="h-5 w-5" />
                ) : (
                  <span className="text-lg">{IconComponent}</span>
                )}
              </div>
              <div className="flex-grow min-w-0">
                <span className="block text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">
                  {getLocalizedCategoryName(category, locale as SupportedLanguage)}
                </span>
                {totalProducts > 0 && (
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    {totalProducts} ofert
                  </span>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
      </div>

      {/* Slide-over Drawer (Sheet panel) for category hierarchy details */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {activeCategory && (() => {
            const style = getCategoryStyle(activeCategory);
            const IconComponent = style.icon;
            return (
              <div className="space-y-6">
                <SheetHeader className="pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-lg flex items-center justify-center w-12 h-12', `bg-gradient-to-br ${style.gradient}`)}>
                      {typeof IconComponent === 'function' ? (
                        <IconComponent className="h-6 w-6 text-white" />
                      ) : (
                        <span className="text-2xl">{IconComponent}</span>
                      )}
                    </div>
                    <div className="text-left">
                      <SheetTitle className="text-xl font-bold font-headline">
                        {getLocalizedCategoryName(activeCategory, locale as SupportedLanguage)}
                      </SheetTitle>
                      <Link
                        href={buildCategoryPath(locale, activeCategory.slug || activeCategory.id || '')}
                        onClick={() => setIsDrawerOpen(false)}
                        className="text-xs text-primary hover:underline flex items-center mt-1 font-medium"
                      >
                        Przeglądaj całą kategorię
                        <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Link>
                    </div>
                  </div>
                </SheetHeader>

                <div className="space-y-6 py-2">
                  {activeCategory.subcategories && activeCategory.subcategories.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {activeCategory.subcategories.map((sub) => (
                        <div key={sub.id} className="space-y-2 pb-4 border-b border-border/40 last:border-0 last:pb-0">
                          {/* Level 2: Subcategory */}
                          <Link
                            href={buildCategoryPath(
                              locale,
                              activeCategory.slug || activeCategory.id || '',
                              sub.slug || sub.id || ''
                            )}
                            onClick={() => setIsDrawerOpen(false)}
                            className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-secondary transition-colors group/sub"
                          >
                            <div className="p-1.5 rounded bg-primary/10 group-hover/sub:bg-primary/20 transition-colors">
                              {sub.icon ? (
                                <span className="text-lg">{sub.icon}</span>
                              ) : (
                                <Package className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm group-hover/sub:text-primary transition-colors">
                                {getLocalizedCategoryName(sub, locale as SupportedLanguage)}
                              </div>
                              {sub.subcategories && sub.subcategories.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {sub.subcategories.length} podkategorie
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover/sub:text-primary transition-[color,transform] group-hover/sub:translate-x-0.5 align-self-center" />
                          </Link>

                          {/* Level 3: Sub-subcategories */}
                          {sub.subcategories && sub.subcategories.length > 0 && (
                            <div className="ml-8 pl-3 border-l-2 border-border space-y-1">
                              {sub.subcategories.map((subsub) => (
                                <Link
                                  key={subsub.id}
                                  href={buildCategoryPath(
                                    locale,
                                    activeCategory.slug || activeCategory.id || '',
                                    sub.slug || sub.id || '',
                                    subsub.slug || subsub.id || ''
                                  )}
                                  onClick={() => setIsDrawerOpen(false)}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-secondary hover:text-primary transition-colors group/subsub"
                                >
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover/subsub:bg-primary" />
                                  <span className="flex-1 truncate">{getLocalizedCategoryName(subsub, locale as SupportedLanguage)}</span>
                                  <ChevronRight className="h-3 w-3 opacity-0 group-hover/subsub:opacity-100 transition-opacity" />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Brak podkategorii
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
