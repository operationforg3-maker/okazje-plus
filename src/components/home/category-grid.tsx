'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
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
  const params = useParams();
  const locale = typeof params?.locale === 'string' ? params.locale : 'pl';

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {categories.map((category) => {
          const style = getCategoryStyle(category);
          const totalProducts = getTotalProducts(category);
          const IconComponent = style.icon;

          return (
            <div key={category.id} className="group">
              {/* Main Category Card */}
              <Card
                className={cn(
                  'border-2 transition-[box-shadow,border-color,transform] duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden cursor-pointer',
                  style.border
                )}
                onClick={() => handleOpenDrawer(category)}
              >
                <CardContent className="p-4">
                  {/* Główny nagłówek - ikona, tytuł i liczba produktów w jednej linii */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-lg flex items-center justify-center w-12 h-12 shrink-0', `bg-gradient-to-br ${style.gradient}`)}>
                      {typeof IconComponent === 'function' ? (
                        <IconComponent className="h-6 w-6 text-white" />
                      ) : (
                        <span className="text-2xl">{IconComponent}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={cn(
                        'text-lg font-bold truncate group-hover:text-primary transition-colors',
                        style.accent
                      )}>
                        {getLocalizedCategoryName(category, locale as SupportedLanguage)}
                      </h3>
                      {totalProducts > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t('productsCount', { count: totalProducts })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Podkategorie - pokazuj wszystkie L2 */}
                  {category.subcategories && category.subcategories.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-hidden">
                        {category.subcategories.slice(0, 4).map((sub) => (
                          <span
                            key={sub.id}
                            className="text-xs px-2 py-1 rounded-md bg-secondary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawer(category);
                            }}
                          >
                            {getLocalizedCategoryName(sub, locale as SupportedLanguage)}
                          </span>
                        ))}
                        {category.subcategories.length > 4 && (
                          <span className="text-xs px-2 py-1 rounded-md bg-secondary/30 text-muted-foreground">
                            +{category.subcategories.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Przycisk View Subcategories */}
                  {category.subcategories && category.subcategories.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDrawer(category);
                      }}
                      className="w-full flex items-center justify-between text-sm font-medium hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-secondary/50"
                    >
                      <span className="flex items-center gap-1.5">
                        <Grid3x3 className="h-4 w-4" />
                        {t('viewSubcategories')}
                      </span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </button>
                  )}
                </CardContent>
              </Card>
            </div>
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
