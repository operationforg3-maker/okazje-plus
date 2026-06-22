/**
 * Unified Filter Sidebar Component
 * Used on both /products and /deals pages
 * 
 * Features:
 * - Price range slider
 * - Rating filter (stars)
 * - In-stock toggle
 * - Discount/Promo filter
 * - Brand multi-select
 * - Source filter (for deals)
 * - Collapsible sections for better mobile UX
 */

'use client';

import React, { useState, useMemo } from 'react';
import { UnifiedFilters, SortBy, SORT_OPTIONS, DEFAULT_FILTERS, CATEGORY_SPECS } from '@/lib/filter-config';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useCurrency } from '@/lib/unified-currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DualRangeSlider } from '@/components/dual-range-slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, X, RotateCcw, Flame, Star, Package, Tag, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnifiedFilterSidebarProps {
  filters: UnifiedFilters;
  onFiltersChange: (filters: UnifiedFilters) => void;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  categoryId?: string;
  brands?: string[];
  onClose?: () => void; // For mobile modal
  isMobile?: boolean;
}

export function UnifiedFilterSidebar({
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  categoryId,
  brands = [],
  onClose,
  isMobile = false,
}: UnifiedFilterSidebarProps) {
  const t = useTranslations('filters');
  const { formatPrice } = useCurrency();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['price', 'sort', 'rating'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const isExpanded = (section: string) => expandedSections.has(section);

  const handlePriceChange = (range: number[]) => {
    onFiltersChange({
      ...filters,
      priceRange: { min: range[0], max: range[1], step: 100 },
    });
  };

  const handleRatingChange = (stars: number) => {
    onFiltersChange({
      ...filters,
      rating: { minStars: stars },
    });
  };

  const handleAvailabilityChange = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      availability: { inStockOnly: checked },
    });
  };

  const handleDiscountChange = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      promo: {
        ...filters.promo,
        discountOnly: checked,
      },
    });
  };

  const handleBrandToggle = (brand: string) => {
    const currentBrands = filters.brands?.brands || [];
    const newBrands = currentBrands.includes(brand)
      ? currentBrands.filter(b => b !== brand)
      : [...currentBrands, brand];

    onFiltersChange({
      ...filters,
      brands: newBrands.length > 0 ? { brands: newBrands } : undefined,
    });
  };

  const handleSourceToggle = (source: 'aliexpress' | 'amazon' | 'allegro') => {
    const currentSources = filters.sources || [];
    const newSources = currentSources.includes(source)
      ? currentSources.filter(s => s !== source)
      : [...currentSources, source];

    onFiltersChange({
      ...filters,
      sources: newSources.length > 0 ? newSources : undefined,
    });
  };

  const handleResetFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters =
    filters.priceRange ||
    filters.rating?.minStars !== undefined ||
    filters.availability?.inStockOnly ||
    filters.promo?.discountOnly ||
    filters.brands?.brands?.length;

  const categorySpecOptions = categoryId ? CATEGORY_SPECS[categoryId] || [] : [];

  return (
    <div className={cn('space-y-4', isMobile && 'p-4')}>
      {/* Header with close and reset buttons */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{t('title')}</h3>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              {t('clear')}
            </Button>
          )}
          {isMobile && onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8" aria-label="Zamknij filtry">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="h-auto pr-4">
        <div className="space-y-3">
          {/* SORT */}
          <Collapsible open={isExpanded('sort')} onOpenChange={() => toggleSection('sort')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 font-medium hover:bg-accent rounded-md px-2">
              <span>{t('sort')}</span>
              <ChevronDown className={cn('w-4 h-4 transition', isExpanded('sort') && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortBy)}>
                <SelectTrigger className="h-9" aria-label={t('sort')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORT_OPTIONS).map(([key, option]) => (
                    <SelectItem key={key} value={key}>
                      {t(`sortOptions.${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CollapsibleContent>
          </Collapsible>

          {/* PRICE RANGE */}
          <Collapsible open={isExpanded('price')} onOpenChange={() => toggleSection('price')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 font-medium hover:bg-accent rounded-md px-2">
              <span>{t('price')}</span>
              <ChevronDown className={cn('w-4 h-4 transition', isExpanded('price') && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <DualRangeSlider
                min={0}
                max={50000}
                step={100}
                value={[
                  filters.priceRange?.min || 0,
                  filters.priceRange?.max || 15000,
                ]}
                onValueChange={handlePriceChange}
                className="w-full"
              />
              <div className="flex gap-2 text-sm justify-between mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground mr-1">{t('min')}</Label>
                  <span className="font-semibold">{formatPrice(filters.priceRange?.min || 0)}</span>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mr-1">{t('max')}</Label>
                  <span className="font-semibold">{formatPrice(filters.priceRange?.max || 15000)}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* RATING */}
          <Collapsible open={isExpanded('rating')} onOpenChange={() => toggleSection('rating')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 font-medium hover:bg-accent rounded-md px-2">
              <span>{t('rating')}</span>
              <ChevronDown className={cn('w-4 h-4 transition', isExpanded('rating') && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => (
                <div key={stars} className="flex items-center gap-2">
                  <Checkbox
                    id={`rating-${stars}`}
                    checked={filters.rating?.minStars === stars}
                    onCheckedChange={() => handleRatingChange(stars)}
                  />
                  <Label htmlFor={`rating-${stars}`} className="flex items-center gap-1 cursor-pointer flex-1">
                    <span className="flex gap-0.5">
                      {Array.from({ length: stars }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </span>
                    <span className="text-sm">{t('ratingStars', { stars })}</span>
                  </Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* AVAILABILITY */}
          <Collapsible open={isExpanded('availability')} onOpenChange={() => toggleSection('availability')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 font-medium hover:bg-accent rounded-md px-2">
              <span className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                {t('availability')}
              </span>
              <ChevronDown className={cn('w-4 h-4 transition', isExpanded('availability') && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="in-stock"
                  checked={filters.availability?.inStockOnly || false}
                  onCheckedChange={handleAvailabilityChange}
                />
                <Label htmlFor="in-stock" className="cursor-pointer flex-1">
                  {t('onlyAvailable')}
                </Label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* PROMOTIONS */}
          <Collapsible open={isExpanded('promo')} onOpenChange={() => toggleSection('promo')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 font-medium hover:bg-accent rounded-md px-2">
              <span className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                {t('promotions')}
              </span>
              <ChevronDown className={cn('w-4 h-4 transition', isExpanded('promo') && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="discount-only"
                  checked={filters.promo?.discountOnly || false}
                  onCheckedChange={handleDiscountChange}
                />
                <Label htmlFor="discount-only" className="cursor-pointer flex-1">
                  {t('onlyDiscount')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="free-shipping" />
                <Label htmlFor="free-shipping" className="cursor-pointer flex-1">
                  {t('freeShipping')}
                </Label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* BRANDS */}
          {brands.length > 0 && (
            <Collapsible open={isExpanded('brands')} onOpenChange={() => toggleSection('brands')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-2 font-medium hover:bg-accent rounded-md px-2">
                <span>{t('brands')}</span>
                <ChevronDown className={cn('w-4 h-4 transition', isExpanded('brands') && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2 max-h-60 overflow-y-auto">
                {brands.map((brand) => (
                  <div key={brand} className="flex items-center gap-2">
                    <Checkbox
                      id={`brand-${brand}`}
                      checked={filters.brands?.brands?.includes(brand) || false}
                      onCheckedChange={() => handleBrandToggle(brand)}
                    />
                    <Label htmlFor={`brand-${brand}`} className="cursor-pointer flex-1 text-sm">
                      {brand}
                    </Label>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* SOURCE (for deals) */}
          <Collapsible open={isExpanded('source')} onOpenChange={() => toggleSection('source')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 font-medium hover:bg-accent rounded-md px-2">
              <span className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                {t('sources')}
              </span>
              <ChevronDown className={cn('w-4 h-4 transition', isExpanded('source') && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {(['aliexpress', 'amazon', 'allegro'] as const).map((source) => (
                <div key={source} className="flex items-center gap-2">
                  <Checkbox
                    id={`source-${source}`}
                    checked={filters.sources?.includes(source) || false}
                    onCheckedChange={() => handleSourceToggle(source)}
                  />
                  <Label htmlFor={`source-${source}`} className="cursor-pointer flex-1 capitalize">
                    {source}
                  </Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Active filters badges */}
      {hasActiveFilters && (
        <div className="pt-2 border-t space-y-2">
          <p className="text-xs text-muted-foreground">{t('activeFilters')}:</p>
          <div className="flex flex-wrap gap-2">
            {filters.priceRange && (
              <Badge variant="secondary" className="gap-1">
                {formatPrice(filters.priceRange.min)} - {formatPrice(filters.priceRange.max)}
                <button
                  onClick={() => handlePriceChange([0, 10000])}
                  className="ml-1 hover:text-destructive"
                  aria-label="Usuń filtr ceny"
                >
                  ✕
                </button>
              </Badge>
            )}
            {filters.rating?.minStars && (
              <Badge variant="secondary" className="gap-1">
                ⭐ {filters.rating.minStars}+
                <button
                  onClick={() => onFiltersChange({ ...filters, rating: undefined })}
                  className="ml-1 hover:text-destructive"
                  aria-label="Usuń filtr oceny"
                >
                  ✕
                </button>
              </Badge>
            )}
            {filters.availability?.inStockOnly && (
              <Badge variant="secondary" className="gap-1">
                {t('onlyAvailable')}
                <button
                  onClick={() => handleAvailabilityChange(false)}
                  className="ml-1 hover:text-destructive"
                  aria-label="Usuń filtr dostępności"
                >
                  ✕
                </button>
              </Badge>
            )}
            {filters.promo?.discountOnly && (
              <Badge variant="secondary" className="gap-1">
                {t('onlyDiscount')}
                <button
                  onClick={() => handleDiscountChange(false)}
                  className="ml-1 hover:text-destructive"
                  aria-label="Usuń filtr promocji"
                >
                  ✕
                </button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
