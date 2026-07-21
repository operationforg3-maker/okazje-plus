'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Category } from '@/lib/types';
import { buildCategoryPath } from '@/lib/category-routes';
import { ChevronRight, Package, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLocalizedCategoryName, SupportedLanguage } from '@/lib/i18n-utils';
import { getCategoryStyle } from '@/lib/category-theme';
import { trackCategoryFilter } from '@/lib/analytics';

interface CategoryGridProps {
  categories: Category[];
}

export default function CategoryGrid({ categories }: CategoryGridProps) {
  const t = useTranslations('home.browseCategories');
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
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

  const handleCategoryClick = (category: Category) => {
    if (activeCategory?.id === category.id) {
      setActiveCategory(null); // Toggle close
    } else {
      setActiveCategory(category); // Open
      trackCategoryFilter(category.slug || category.id || '');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Main Grid View - Top Level Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {categories.map((category) => {
          const style = getCategoryStyle(category);
          const totalProducts = getTotalProducts(category);
          const IconComponent = style.icon;
          const isActive = activeCategory?.id === category.id;

          return (
            <div
              key={category.id}
              className={cn(
                "transition-all duration-300 flex flex-col group relative",
                isActive
                  ? "col-span-full bg-background border border-primary/20 shadow-2xl rounded-3xl p-5 sm:p-6"
                  : "ux-card-container cursor-pointer p-3"
              )}
              onClick={!isActive ? () => handleCategoryClick(category) : undefined}
            >
              {/* Header/Button Row */}
              <div className="flex items-center justify-between w-full min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                  <div className={cn(
                    "ux-icon-box flex items-center justify-center flex-shrink-0 bg-gradient-to-br shadow-sm",
                    isActive ? "p-2.5 shadow-lg w-12 h-12" : "h-10 w-10",
                    style.bg,
                    style.accent
                  )}>
                    {typeof IconComponent === 'function' ? (
                      <IconComponent className={cn(isActive ? "h-6 w-6" : "h-5 w-5")} />
                    ) : (
                      <span className={cn(isActive ? "text-2xl" : "text-lg")}>{IconComponent}</span>
                    )}
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <span className={cn(
                      "block font-bold text-foreground transition-colors",
                      isActive ? "text-xl font-headline font-black" : "text-sm truncate group-hover:text-primary"
                    )}>
                      {getLocalizedCategoryName(category, locale as SupportedLanguage)}
                    </span>
                    {!isActive && totalProducts > 0 && (
                      <span className="block text-[10px] text-muted-foreground mt-0.5 font-medium truncate">
                        {totalProducts} ofert
                      </span>
                    )}
                    {isActive && (
                      <Link
                        href={buildCategoryPath(locale, category.slug || category.id || '')}
                        className="text-xs text-primary hover:underline flex items-center mt-1 font-semibold"
                      >
                        Przeglądaj całą kategorię
                        <ChevronRight className="h-3 w-3 ml-0.5" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Right side icon / Close button */}
                {isActive ? (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveCategory(null); }} 
                    className="p-2 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors relative z-10 shrink-0"
                    aria-label="Zamknij podkategorie"
                    title="Zamknij"
                  >
                    <X className="h-5 w-5" />
                  </button>
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 shrink-0" />
                )}
              </div>

              {/* Subcategories list - Rendered only when active */}
              {isActive && (
                <div className="mt-6 pt-6 border-t border-border/20 max-h-[500px] overflow-y-auto pr-1">
                  {category.subcategories && category.subcategories.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                      {category.subcategories.map((sub) => (
                        <div 
                          key={sub.id} 
                          className="space-y-3 p-4 ux-card-container"
                        >
                          {/* Level 2: Subcategory Link */}
                          <Link
                            href={buildCategoryPath(
                              locale,
                              category.slug || category.id || '',
                              sub.slug || sub.id || ''
                            )}
                            className="flex items-center gap-2.5 font-bold text-sm text-foreground hover:text-primary transition-colors group/sub"
                            onClick={() => trackCategoryFilter(
                              category.slug || category.id || '',
                              sub.slug || sub.id || ''
                            )}
                          >
                            <div className={cn("p-1.5 rounded-lg text-primary flex items-center justify-center bg-gradient-to-br", style.bg, style.accent)}>
                              {sub.icon ? (
                                <span className="text-sm font-black">{sub.icon}</span>
                              ) : (
                                <Package className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <span className="truncate">{getLocalizedCategoryName(sub, locale as SupportedLanguage)}</span>
                            <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover/sub:opacity-100 group-hover/sub:translate-x-0.5 transition-all text-primary" />
                          </Link>

                          {/* Level 3: Sub-subcategories Links */}
                          {sub.subcategories && sub.subcategories.length > 0 && (
                            <div className="space-y-1.5 pl-2 border-l border-border/40">
                              {sub.subcategories.map((subsub) => (
                                <Link
                                  key={subsub.id}
                                  href={buildCategoryPath(
                                    locale,
                                    category.slug || category.id || '',
                                    sub.slug || sub.id || '',
                                    subsub.slug || subsub.id || ''
                                  )}
                                  className="flex items-center gap-1.5 py-1 px-2 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-secondary/40 transition-colors group/subsub"
                                  onClick={() => trackCategoryFilter(
                                    category.slug || category.id || '',
                                    `${sub.slug || sub.id}/${subsub.slug || subsub.id}`
                                  )}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 group-hover/subsub:bg-primary transition-colors" />
                                  <span className="flex-grow truncate">{getLocalizedCategoryName(subsub, locale as SupportedLanguage)}</span>
                                  <ChevronRight className="h-3 w-3 opacity-0 group-hover/subsub:opacity-100 transition-opacity ml-1" />
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
