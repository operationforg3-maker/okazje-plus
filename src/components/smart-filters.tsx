"use client";

/**
 * ========================================
 * SMART FILTERS — Inteligentne filtry produktów
 * ========================================
 * 
 * Advanced filtering with M4 Smart features:
 * ✅ "Tylko z darmową dostawą" (isFreeShipping filter)
 * ✅ "Zweryfikowany Sprzedawca" (merchantRating >= 95%)
 * ✅ "Bestseller" (ordersCount > 1000)
 * ✅ Price range slider
 * ✅ Rating filter (4★+, 4.5★+)
 * ✅ Sort options (price, rating, popularity)
 */

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Truck,
  Award,
  TrendingUp,
  Star,
  SlidersHorizontal,
  X,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOptions {
  freeShipping: boolean;
  verifiedMerchant: boolean;
  bestseller: boolean;
  minRating: number;
  priceRange: [number, number];
  sortBy: 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'newest';
}

interface SmartFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  maxPrice?: number;
  className?: string;
}

export default function SmartFilters({ 
  filters, 
  onFiltersChange, 
  maxPrice = 1000,
  className 
}: SmartFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FilterOptions>(filters);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Update parent when local filters change
  useEffect(() => {
    onFiltersChange(localFilters);
    
    // Count active filters
    let count = 0;
    if (localFilters.freeShipping) count++;
    if (localFilters.verifiedMerchant) count++;
    if (localFilters.bestseller) count++;
    if (localFilters.minRating > 0) count++;
    if (localFilters.priceRange[0] > 0 || localFilters.priceRange[1] < maxPrice) count++;
    setActiveFiltersCount(count);
  }, [localFilters, maxPrice, onFiltersChange]);

  const handleToggle = (key: keyof Omit<FilterOptions, 'minRating' | 'priceRange' | 'sortBy'>) => {
    setLocalFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePriceChange = (value: number[]) => {
    setLocalFilters(prev => ({ ...prev, priceRange: [value[0], value[1]] }));
  };

  const handleRatingChange = (value: string) => {
    setLocalFilters(prev => ({ ...prev, minRating: parseFloat(value) }));
  };

  const handleSortChange = (value: string) => {
    setLocalFilters(prev => ({ ...prev, sortBy: value as FilterOptions['sortBy'] }));
  };

  const resetFilters = () => {
    setLocalFilters({
      freeShipping: false,
      verifiedMerchant: false,
      bestseller: false,
      minRating: 0,
      priceRange: [0, maxPrice],
      sortBy: 'popularity'
    });
  };

  return (
    <div className={cn("space-y-6", className)}>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Filtry</h3>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount}
            </Badge>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetFilters}
            className="text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Wyczyść
          </Button>
        )}
      </div>

      <Separator />

      {/* Sort Options */}
      <div className="space-y-2">
        <Label htmlFor="sort" className="text-sm font-medium">
          Sortowanie
        </Label>
        <Select value={localFilters.sortBy} onValueChange={handleSortChange}>
          <SelectTrigger id="sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popularity">Najpopularniejsze</SelectItem>
            <SelectItem value="newest">Najnowsze</SelectItem>
            <SelectItem value="price_asc">Cena: od najniższej</SelectItem>
            <SelectItem value="price_desc">Cena: od najwyższej</SelectItem>
            <SelectItem value="rating">Najwyżej oceniane</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Smart Toggles */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Szybkie filtry</Label>

        {/* Free Shipping Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className={cn(
              "w-4 h-4",
              localFilters.freeShipping ? "text-emerald-500" : "text-gray-400"
            )} />
            <span className="text-sm">Darmowa dostawa</span>
          </div>
          <Switch
            checked={localFilters.freeShipping}
            onCheckedChange={() => handleToggle('freeShipping')}
          />
        </div>

        {/* Verified Merchant Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className={cn(
              "w-4 h-4",
              localFilters.verifiedMerchant ? "text-indigo-500" : "text-gray-400"
            )} />
            <span className="text-sm">Zweryfikowany sprzedawca</span>
          </div>
          <Switch
            checked={localFilters.verifiedMerchant}
            onCheckedChange={() => handleToggle('verifiedMerchant')}
          />
        </div>

        {/* Bestseller Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className={cn(
              "w-4 h-4",
              localFilters.bestseller ? "text-amber-500" : "text-gray-400"
            )} />
            <span className="text-sm">Bestseller (1000+ zamówień)</span>
          </div>
          <Switch
            checked={localFilters.bestseller}
            onCheckedChange={() => handleToggle('bestseller')}
          />
        </div>
      </div>

      <Separator />

      {/* Rating Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Minimalna ocena</Label>
        <Select 
          value={localFilters.minRating.toString()} 
          onValueChange={handleRatingChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Wszystkie</SelectItem>
            <SelectItem value="3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                3.0+
              </div>
            </SelectItem>
            <SelectItem value="4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                4.0+
              </div>
            </SelectItem>
            <SelectItem value="4.5">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                4.5+
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Price Range Slider */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Zakres cen: {localFilters.priceRange[0]} zł - {localFilters.priceRange[1]} zł
        </Label>
        <Slider
          value={localFilters.priceRange}
          onValueChange={handlePriceChange}
          min={0}
          max={maxPrice}
          step={10}
          className="mt-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0 zł</span>
          <span>{maxPrice} zł</span>
        </div>
      </div>

      {/* Active Filters Summary */}
      {activeFiltersCount > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Aktywne filtry:</Label>
            <div className="flex flex-wrap gap-2">
              {localFilters.freeShipping && (
                <Badge variant="secondary" className="gap-1">
                  <Truck className="w-3 h-3" />
                  Darmowa dostawa
                  <X 
                    className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" 
                    onClick={() => handleToggle('freeShipping')}
                  />
                </Badge>
              )}
              {localFilters.verifiedMerchant && (
                <Badge variant="secondary" className="gap-1">
                  <Award className="w-3 h-3" />
                  Zweryfikowany
                  <X 
                    className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" 
                    onClick={() => handleToggle('verifiedMerchant')}
                  />
                </Badge>
              )}
              {localFilters.bestseller && (
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Bestseller
                  <X 
                    className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" 
                    onClick={() => handleToggle('bestseller')}
                  />
                </Badge>
              )}
              {localFilters.minRating > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Star className="w-3 h-3 fill-yellow-400" />
                  {localFilters.minRating}+
                  <X 
                    className="w-3 h-3 ml-1 cursor-pointer hover:text-red-500" 
                    onClick={() => handleRatingChange('0')}
                  />
                </Badge>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Export default filter values
export const defaultFilters: FilterOptions = {
  freeShipping: false,
  verifiedMerchant: false,
  bestseller: false,
  minRating: 0,
  priceRange: [0, 1000],
  sortBy: 'popularity'
};
