'use client';

import React from 'react';
import { Category, Subcategory } from '@/lib/types';
import { getCategoryStyle } from '@/lib/category-theme';
import { getLocalizedCategoryName, type SupportedLanguage } from '@/lib/i18n-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronRight, Flame, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategorySidebarProps {
  title?: string;
  categories: Category[];
  selectedCategory: Category | null;
  selectedSubcategory: string | null;
  selectedSubSubcategory: string | null;
  onSelectAll: () => void;
  onSelectCategory: (category: Category) => void;
  onSelectSubcategory: (subSlug: string) => void;
  onSelectSubSubcategory: (subSlug: string, subSubSlug: string) => void;
  locale: string;
  allLabel?: string;
  type?: 'deals' | 'products';
}

export function CategorySidebar({
  title = 'Kategorie',
  categories,
  selectedCategory,
  selectedSubcategory,
  selectedSubSubcategory,
  onSelectAll,
  onSelectCategory,
  onSelectSubcategory,
  onSelectSubSubcategory,
  locale,
  allLabel,
  type = 'deals',
}: CategorySidebarProps) {
  const isAllActive = !selectedCategory;
  const lang = locale as SupportedLanguage;

  const defaultAllLabel = allLabel || (type === 'deals' ? 'Wszystkie okazje' : 'Wszystkie produkty');
  const AllIcon = type === 'deals' ? Flame : Package;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <h2 className="font-headline text-lg font-bold tracking-tight text-foreground">
          {title}
        </h2>
      </div>

      <ScrollArea className="h-[calc(100vh-220px)] lg:h-[650px] pr-1.5">
        {/* All Button */}
        <div className="mb-2">
          <button
            type="button"
            onClick={onSelectAll}
            className={cn(
              "w-full text-left px-3.5 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-3 group text-sm font-semibold mb-1",
              isAllActive
                ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md shadow-teal-500/20 font-bold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            <div
              className={cn(
                "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                isAllActive
                  ? "bg-white/20 text-white"
                  : "bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:bg-teal-500/20"
              )}
            >
              <AllIcon className="h-4 w-4" />
            </div>
            <span className="flex-1 truncate">{defaultAllLabel}</span>
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform opacity-60",
                isAllActive ? "rotate-90 opacity-100" : "group-hover:translate-x-1 group-hover:opacity-100"
              )}
            />
          </button>
        </div>

        {/* Category List */}
        <div className="space-y-1">
          {categories.map((category) => {
            const isActive = selectedCategory?.id === category.id;
            const style = getCategoryStyle(category);
            const IconComponent = style.icon;
            const catName = getLocalizedCategoryName(category, lang);

            return (
              <div key={category.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => onSelectCategory(category)}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-3 group text-sm font-semibold",
                    isActive
                      ? `bg-gradient-to-r ${style.gradient} text-white shadow-md shadow-primary/15 font-bold`
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center transition-all shrink-0",
                      isActive
                        ? "bg-white/20 text-white"
                        : cn("bg-gradient-to-br", style.bg, style.accent)
                    )}
                  >
                    {typeof IconComponent === 'function' ? (
                      <IconComponent className="h-4 w-4" />
                    ) : (
                      <span className="text-sm">{IconComponent}</span>
                    )}
                  </div>
                  <span className="flex-1 truncate">{catName}</span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform opacity-60",
                      isActive ? "rotate-90 opacity-100" : "group-hover:translate-x-1 group-hover:opacity-100"
                    )}
                  />
                </button>

                {/* Subcategories (L2) */}
                {isActive && category.subcategories && category.subcategories.length > 0 && (
                  <div className="ml-3 pl-3 border-l-2 border-primary/20 space-y-1 py-1">
                    {category.subcategories.map((sub) => {
                      const subSlug = sub.slug || sub.id;
                      const isSubActive = selectedSubcategory === subSlug;

                      return (
                        <div key={subSlug} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => onSelectSubcategory(subSlug)}
                            className={cn(
                              "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors",
                              isSubActive
                                ? "bg-primary/15 text-primary font-bold shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            )}
                          >
                            <span className="truncate">
                              {getLocalizedCategoryName(sub as any, lang)}
                            </span>
                            {sub.subcategories && sub.subcategories.length > 0 && (
                              <ChevronRight
                                className={cn(
                                  "h-3 w-3 opacity-50 transition-transform",
                                  isSubActive ? "rotate-90 opacity-100" : ""
                                )}
                              />
                            )}
                          </button>

                          {/* Sub-subcategories (L3) */}
                          {isSubActive && sub.subcategories && sub.subcategories.length > 0 && (
                            <div className="ml-2 pl-2 border-l border-primary/10 space-y-0.5 py-0.5">
                              {sub.subcategories.map((subSub) => {
                                const subSubSlug = subSub.slug || subSub.id;
                                const isSubSubActive = selectedSubSubcategory === subSubSlug;

                                return (
                                  <button
                                    key={subSubSlug}
                                    type="button"
                                    onClick={() => onSelectSubSubcategory(subSlug, subSubSlug)}
                                    className={cn(
                                      "w-full text-left px-2 py-1 rounded text-[11px] flex items-center gap-1.5 transition-colors",
                                      isSubSubActive
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                    )}
                                  >
                                    <span className="truncate">
                                      {getLocalizedCategoryName(subSub as any, lang)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
