'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Category } from '@/lib/types';
import { ChevronRight, Grid3x3, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

// Helper to extract name from either string or LocalizedText object
function getName(name: any): string {
  if (typeof name === 'string') return name;
  if (name && typeof name === 'object') {
    return name.pl || name.en || name.de || 'Kategoria';
  }
  return 'Kategoria';
}

interface CategoryGridProps {
  categories: Category[];
}

// Category colors and gradients for better visual variety
const CATEGORY_STYLES = [
  { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-200', accent: 'text-blue-600', gradient: 'from-blue-500 to-cyan-500' },
  { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-200', accent: 'text-purple-600', gradient: 'from-purple-500 to-pink-500' },
  { bg: 'from-orange-500/20 to-red-500/20', border: 'border-orange-200', accent: 'text-orange-600', gradient: 'from-orange-500 to-red-500' },
  { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-200', accent: 'text-green-600', gradient: 'from-green-500 to-emerald-500' },
  { bg: 'from-red-500/20 to-pink-500/20', border: 'border-red-200', accent: 'text-red-600', gradient: 'from-red-500 to-pink-500' },
  { bg: 'from-indigo-500/20 to-purple-500/20', border: 'border-indigo-200', accent: 'text-indigo-600', gradient: 'from-indigo-500 to-purple-500' },
  { bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-200', accent: 'text-amber-600', gradient: 'from-amber-500 to-orange-500' },
  { bg: 'from-teal-500/20 to-cyan-500/20', border: 'border-teal-200', accent: 'text-teal-600', gradient: 'from-teal-500 to-cyan-500' },
];

export default function CategoryGrid({ categories }: CategoryGridProps) {
  const t = useTranslations('home.browseCategories');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // Count total subcategories (sub + subsub)
  const getTotalSubcategories = (category: Category) => {
    let total = category.subcategories?.length || 0;
    category.subcategories?.forEach(sub => {
      total += sub.subcategories?.length || 0;
    });
    return total;
  };

  return (
    <div className="w-full space-y-8">
      {/* Main Grid View - Top Level Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {categories.map((category, idx) => {
          const style = CATEGORY_STYLES[idx % CATEGORY_STYLES.length];
          const totalSubs = getTotalSubcategories(category);
          const totalProducts = getTotalProducts(category);
          const isExpanded = expandedId === category.id;

          return (
            <div key={category.id} className="group">
              {/* Main Category Card */}
              <Card
                className={cn(
                  'border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden',
                  style.border,
                  isExpanded && 'ring-2 ring-primary'
                )}
                onMouseEnter={() => setHoveredId(category.id || null)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <CardContent className="p-4">
                  {/* Główny nagłówek - ikona, tytuł i liczba produktów w jednej linii */}
                  <Link 
                    href={`/products?category=${category.slug || category.id}`}
                    className="flex items-center gap-3 mb-3 group/title"
                  >
                    <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-lg', `bg-gradient-to-br ${style.gradient}`)}>
                      {category.icon ? (
                        <span className="text-2xl">{category.icon}</span>
                      ) : (
                        <Package className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className={cn(
                        'text-lg font-bold transition-colors group-hover/title:text-primary',
                        style.accent
                      )}>
                        {getName(category.name)}
                      </h3>
                      {totalProducts > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t('productsCount', { count: totalProducts })}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Podkategorie - pokazuj wszystkie L2 */}
                  {category.subcategories && category.subcategories.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {category.subcategories.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/products?category=${category.slug || category.id}&subcategory=${sub.slug || sub.id}`}
                            className="text-xs px-2 py-1 rounded-md bg-secondary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Przycisk View Subcategories */}
                  {category.subcategories && category.subcategories.length > 0 && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : category.id || null)}
                      className="w-full flex items-center justify-between text-sm font-medium hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-secondary/50"
                    >
                      <span className="flex items-center gap-1.5">
                        <Grid3x3 className="h-4 w-4" />
                        {t('viewSubcategories')}
                      </span>
                      <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
                    </button>
                  )}
                </CardContent>
              </Card>

              {/* Expanded Subcategories Panel (3-level hierarchy) */}
              {isExpanded && category.subcategories && category.subcategories.length > 0 && (
                <Card className="mt-4 border-2 border-primary/20 animate-in slide-in-from-top-5">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 gap-3">
                      {category.subcategories.map((sub) => (
                        <div key={sub.id} className="space-y-2">
                          {/* Level 2: Subcategory */}
                          <Link
                            href={`/products?category=${category.slug || category.id}&subcategory=${sub.slug || sub.id}`}
                            className="flex items-start gap-2 p-2 rounded-lg hover:bg-secondary transition-colors group/sub"
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
                                {sub.name}
                              </div>
                              {sub.subcategories && sub.subcategories.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {t('subcategoryCount', { count: sub.subcategories.length })}
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover/sub:text-primary transition-all group-hover/sub:translate-x-0.5" />
                          </Link>

                          {/* Level 3: Sub-subcategories */}
                          {sub.subcategories && sub.subcategories.length > 0 && (
                            <div className="ml-8 pl-3 border-l-2 border-border space-y-1">
                              {sub.subcategories.map((subsub) => (
                                <Link
                                  key={subsub.id}
                                  href={`/products?category=${category.slug || category.id}&subcategory=${sub.slug || sub.id}&subsubcategory=${subsub.slug || subsub.id}`}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-secondary hover:text-primary transition-colors group/subsub"
                                >
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary/40 group-hover/subsub:bg-primary" />
                                  <span className="flex-1">{subsub.name}</span>
                                  <ChevronRight className="h-3 w-3 opacity-0 group-hover/subsub:opacity-100 transition-opacity" />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}


