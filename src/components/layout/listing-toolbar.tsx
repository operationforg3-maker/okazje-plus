'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SortSelect } from '@/components/sort-select';
import { UnifiedFilterSidebar } from '@/components/unified-filter-sidebar';
import { Search, Filter, LayoutGrid, List, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'list';

interface ListingToolbarProps {
  title: string;
  description?: string;
  totalCount?: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: string;
  onSortByChange: (sort: string) => void;
  activeFilterCount?: number;
  onResetFilters?: () => void;
  // Filters sidebar props for mobile sheet
  categories?: any[];
  currentCategorySlug?: string;
  selectedSubcategorySlug?: string;
  priceRange?: [number, number];
  onPriceChange?: (range: [number, number]) => void;
  quickFilters?: any;
  onQuickFilterToggle?: (key: string) => void;
  badgeText?: string;
}

export function ListingToolbar({
  title,
  description,
  totalCount,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortByChange,
  activeFilterCount = 0,
  onResetFilters,
  categories = [],
  currentCategorySlug = '',
  selectedSubcategorySlug = '',
  priceRange = [0, 10000],
  onPriceChange,
  quickFilters,
  onQuickFilterToggle,
  badgeText,
}: ListingToolbarProps) {
  return (
    <div className="space-y-4 mb-6">
      {/* Header Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-foreground">
              {title}
            </h1>
            {badgeText && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                <Sparkles className="h-3 w-3 mr-1" />
                {badgeText}
              </Badge>
            )}
            {typeof totalCount === 'number' && (
              <Badge variant="outline" className="text-muted-foreground text-xs">
                {totalCount}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>

        {/* Controls Bar: Search, Mobile Filters, View Switcher & Sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Szukaj..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm rounded-lg bg-card border-border"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Button (Sheet Drawer) */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border">
                  <Filter className="h-4 w-4" />
                  <span>Filtry</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="default" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[360px] p-0">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-bold">Filtry</h2>
                </div>
                <div className="p-4 overflow-y-auto max-h-[calc(100vh-80px)]">
                  <UnifiedFilterSidebar
                    categories={categories}
                    currentCategorySlug={currentCategorySlug}
                    selectedSubcategorySlug={selectedSubcategorySlug}
                    priceRange={priceRange}
                    onPriceChange={onPriceChange || (() => {})}
                    quickFilters={quickFilters || {}}
                    onQuickFilterToggle={onQuickFilterToggle || (() => {})}
                    onReset={onResetFilters || (() => {})}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* View Switcher (Grid vs List) */}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('grid')}
              className={cn(
                "h-8 px-2.5 rounded-md text-xs gap-1.5 transition-colors",
                viewMode === 'grid'
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Siatka</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewModeChange('list')}
              className={cn(
                "h-8 px-2.5 rounded-md text-xs gap-1.5 transition-colors",
                viewMode === 'list'
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>

          {/* Sort Dropdown */}
          <div className="h-9">
            <SortSelect
              value={sortBy}
              onValueChange={onSortByChange}
            />
          </div>
        </div>
      </div>

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && onResetFilters && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground font-medium">Aktywne filtry ({activeFilterCount}):</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-6 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <X className="h-3 w-3 mr-1" />
            Wyczyść filtry
          </Button>
        </div>
      )}
    </div>
  );
}
