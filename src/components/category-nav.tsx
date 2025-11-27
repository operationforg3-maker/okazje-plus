'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Category, Subcategory, SubSubcategory } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  categories: Category[];
  selectedCategoryId?: string | null;
  selectedSubcategorySlug?: string | null;
  selectedSubSubcategorySlug?: string | null;
  onCategorySelect?: (category: Category) => void;
  onSubcategorySelect?: (subcategory: Subcategory) => void;
  onSubSubcategorySelect?: (subSubcategory: SubSubcategory) => void;
  basePath?: string; // '/deals' or '/products'
}

export default function CategoryNav({
  categories,
  selectedCategoryId,
  selectedSubcategorySlug,
  selectedSubSubcategorySlug,
  onCategorySelect,
  onSubcategorySelect,
  onSubSubcategorySelect,
  basePath = '/deals',
}: Props) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(selectedCategoryId ? [selectedCategoryId] : [])
  );
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(
    new Set(selectedSubcategorySlug ? [selectedSubcategorySlug] : [])
  );

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubcategory = (subcategorySlug: string) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(subcategorySlug)) {
      newExpanded.delete(subcategorySlug);
    } else {
      newExpanded.add(subcategorySlug);
    }
    setExpandedSubcategories(newExpanded);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-4">
        {/* All Items Link */}
        <Button
          variant={!selectedCategoryId ? 'default' : 'ghost'}
          className="w-full justify-start"
          asChild
        >
          <Link href={basePath}>
            <Layers className="mr-2 h-4 w-4" />
            Wszystkie
          </Link>
        </Button>

        {/* Categories Tree */}
        {categories.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          const isSelected = selectedCategoryId === category.id;
          const hasSubcategories = category.subcategories && category.subcategories.length > 0;

          return (
            <div key={category.id} className="space-y-1">
              {/* Main Category */}
              <div className="flex items-center gap-1">
                {hasSubcategories && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => toggleCategory(category.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant={isSelected && !selectedSubcategorySlug ? 'secondary' : 'ghost'}
                  className={cn(
                    'flex-1 justify-start',
                    !hasSubcategories && 'ml-9'
                  )}
                  onClick={() => onCategorySelect?.(category)}
                  asChild={!!onCategorySelect}
                >
                  {onCategorySelect ? (
                    <button type="button">
                      <span className="mr-2">{category.icon || '📁'}</span>
                      <span className="truncate">{category.name}</span>
                    </button>
                  ) : (
                    <Link href={`${basePath}?category=${category.slug || category.id}`}>
                      <span className="mr-2">{category.icon || '📁'}</span>
                      <span className="truncate">{category.name}</span>
                    </Link>
                  )}
                </Button>
              </div>

              {/* Subcategories (Level 2) */}
              {isExpanded && hasSubcategories && (
                <div className="ml-6 space-y-1 border-l-2 border-border pl-2">
                  {category.subcategories!.map((subcategory) => {
                    const isSubExpanded = expandedSubcategories.has(subcategory.slug);
                    const isSubSelected = selectedSubcategorySlug === subcategory.slug;
                    const hasSubSubcategories = subcategory.subcategories && subcategory.subcategories.length > 0;

                    return (
                      <div key={subcategory.slug} className="space-y-1">
                        {/* Subcategory */}
                        <div className="flex items-center gap-1">
                          {hasSubSubcategories && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => toggleSubcategory(subcategory.slug)}
                            >
                              {isSubExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant={isSubSelected && !selectedSubSubcategorySlug ? 'secondary' : 'ghost'}
                            size="sm"
                            className={cn(
                              'flex-1 justify-start text-sm',
                              !hasSubSubcategories && 'ml-9'
                            )}
                            onClick={() => onSubcategorySelect?.(subcategory)}
                            asChild={!!onSubcategorySelect}
                          >
                            {onSubcategorySelect ? (
                              <button type="button">
                                <span className="mr-2 text-xs">{subcategory.icon || '📄'}</span>
                                <span className="truncate">{subcategory.name}</span>
                              </button>
                            ) : (
                              <Link href={`${basePath}?category=${category.slug || category.id}&sub=${subcategory.slug}`}>
                                <span className="mr-2 text-xs">{subcategory.icon || '📄'}</span>
                                <span className="truncate">{subcategory.name}</span>
                              </Link>
                            )}
                          </Button>
                        </div>

                        {/* Sub-Subcategories (Level 3) */}
                        {isSubExpanded && hasSubSubcategories && (
                          <div className="ml-6 space-y-1 border-l-2 border-border/50 pl-2">
                            {subcategory.subcategories!.map((subSubcategory) => {
                              const isSubSubSelected = selectedSubSubcategorySlug === subSubcategory.slug;

                              return (
                                <Button
                                  key={subSubcategory.slug}
                                  variant={isSubSubSelected ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className="w-full justify-start text-xs pl-2"
                                  onClick={() => onSubSubcategorySelect?.(subSubcategory)}
                                  asChild={!!onSubSubcategorySelect}
                                >
                                  {onSubSubcategorySelect ? (
                                    <button type="button">
                                      <span className="mr-2 text-xs">{subSubcategory.icon || '•'}</span>
                                      <span className="truncate">{subSubcategory.name}</span>
                                    </button>
                                  ) : (
                                    <Link href={`${basePath}?category=${category.slug || category.id}&sub=${subcategory.slug}&subsub=${subSubcategory.slug}`}>
                                      <span className="mr-2 text-xs">{subSubcategory.icon || '•'}</span>
                                      <span className="truncate">{subSubcategory.name}</span>
                                    </Link>
                                  )}
                                </Button>
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
  );
}
