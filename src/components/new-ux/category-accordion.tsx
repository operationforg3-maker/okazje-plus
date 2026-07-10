'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Category } from '@/lib/types';
import { buildCategoryPath, buildCategoryPathNewUx } from '@/lib/category-routes';
import { ChevronRight, Package, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLocalizedCategoryName, SupportedLanguage } from '@/lib/i18n-utils';
import { getCategoryStyle } from '@/lib/category-theme';

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
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category)}
              className={cn(
                "w-full flex items-center gap-3 p-3 text-left group relative",
                isActive
                  ? "bg-background border-primary shadow-lg ring-2 ring-primary/20 -translate-y-0.5"
                  : "ux-card-container"
              )}
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
                  <span className="block text-[10px] text-muted-foreground mt-0.5 font-medium">
                    {totalProducts} ofert
                  </span>
                )}
              </div>
              <ChevronRight className={cn(
                "h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-all",
                isActive ? "rotate-90 text-primary opacity-100" : "group-hover:translate-x-0.5"
              )} />
            </button>
          );
        })}
      </div>

      {/* Collapsible Subcategories Panel - Grid Accordion Layout */}
      <div 
        className={cn(
          "overflow-hidden transition-all duration-500 ease-in-out relative",
          activeCategory ? "max-h-[1000px] opacity-100 py-2" : "max-h-0 opacity-0 py-0"
        )}
      >
        {activeCategory && (() => {
          const style = getCategoryStyle(activeCategory);
          const IconComponent = style.icon;
          return (
            <div className="bg-background/40 backdrop-blur-xl border border-border/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              {/* Subtle background glow matching category theme */}
              <div className={cn("absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none bg-gradient-to-br", style.bg)} />

              {/* Close Button */}
              <button 
                onClick={() => setActiveCategory(null)} 
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors z-10"
                aria-label="Zamknij podkategorie"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Category Title Header */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border/20 relative z-10">
                <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-lg flex items-center justify-center w-12 h-12', style.bg, style.accent)}>
                  {typeof IconComponent === 'function' ? (
                    <IconComponent className="h-6 w-6" />
                  ) : (
                    <span className="text-2xl">{IconComponent}</span>
                  )}
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold font-headline text-foreground">
                    {getLocalizedCategoryName(activeCategory, locale as SupportedLanguage)}
                  </h3>
                  <Link
                    href={buildCategoryPathNewUx(locale, activeCategory.slug || activeCategory.id || '')}
                    className="text-xs text-primary hover:underline flex items-center mt-1 font-semibold"
                  >
                    Przeglądaj całą kategorię
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Link>
                </div>
              </div>

              {/* Subcategories Grid List */}
              <div className="max-h-[500px] overflow-y-auto pr-1 relative z-10">
                {activeCategory.subcategories && activeCategory.subcategories.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    {activeCategory.subcategories.map((sub) => (
                      <div 
                        key={sub.id} 
                        className="space-y-3 p-4 rounded-2xl bg-background/55 border border-border/40 hover:border-primary/20 hover:bg-background/80 transition-all duration-300 shadow-sm hover:shadow-md"
                      >
                        {/* Level 2: Subcategory Link */}
                        <Link
                          href={buildCategoryPathNewUx(
                            locale,
                            activeCategory.slug || activeCategory.id || '',
                            sub.slug || sub.id || ''
                          )}
                          className="flex items-center gap-2.5 font-bold text-sm text-foreground hover:text-primary transition-colors group/sub"
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
                                href={buildCategoryPathNewUx(
                                  locale,
                                  activeCategory.slug || activeCategory.id || '',
                                  sub.slug || sub.id || '',
                                  subsub.slug || subsub.id || ''
                                )}
                                className="flex items-center gap-1.5 py-1 px-2 rounded-md text-xs text-muted-foreground hover:text-primary hover:bg-secondary/40 transition-colors group/subsub"
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
            </div>
          );
        })()}
      </div>
    </div>
  );
}
