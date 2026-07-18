'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { searchProducts, searchDeals } from '@/lib/search';
import ProductListCard from '@/components/product-list-card';
import ProductCard from '@/components/product-card';
import DealCard from '@/components/deal-card';
import { ProductCore, Deal } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Filter, X, SlidersHorizontal, Bookmark, Zap, Truck, Star, Flame, ShieldCheck } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { QUICK_FILTERS } from '@/lib/saved-searches';
import SavedSearchDialog from '@/components/saved-search-dialog';
import { useTranslations } from 'next-intl';
import type { SavedSearchFilters } from '@/lib/saved-searches';
import { useCurrency } from '@/lib/unified-currency';

interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  minTemperature?: number;
  minRating?: number;
  sortBy: string;
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="page-container py-8 md:py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded w-1/3"></div>
          <div className="h-6 bg-muted rounded w-1/2"></div>
          <div className="h-10 bg-muted rounded"></div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-80 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const t = useTranslations('search');
  const tActions = useTranslations('common.actions');
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';

  const [products, setProducts] = useState<ProductCore[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'relevance',
  });

  useEffect(() => {
    async function fetchResults() {
      if (q) {
        setLoading(true);
        try {
          const [productResults, dealResults] = await Promise.all([
            searchProducts(q, {
              limit: 50,
              minPrice: filters.minPrice,
              maxPrice: filters.maxPrice,
              minRating: filters.minRating,
              sortBy: filters.sortBy as any,
            }),
            searchDeals(q, {
              limit: 50,
              minPrice: filters.minPrice,
              maxPrice: filters.maxPrice,
              minTemperature: filters.minTemperature,
              sortBy: filters.sortBy as any,
            }),
          ]);
          setProducts(productResults);
          setDeals(dealResults);
        } catch (err) {
          console.error('Search failed:', err);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchResults();
  }, [q, filters]);

  const clearFilters = () => {
    setFilters({ sortBy: 'relevance' });
  };

  const applyQuickFilter = (preset: typeof QUICK_FILTERS[0]) => {
    const newFilters: SearchFilters = {
      sortBy: 'relevance',
      minPrice: preset.filters.minPrice,
      maxPrice: preset.filters.maxPrice,
      minTemperature: preset.filters.minTemperature,
    };
    setFilters(newFilters);
  };

  const getQuickFilterIcon = (name: string) => {
    if (name.includes('🔥')) return Flame;
    if (name.includes('🚚')) return Truck;
    if (name.includes('💎')) return Star;
    if (name.includes('⚡')) return Zap;
    if (name.includes('✅')) return ShieldCheck;
    return Filter;
  };

  const hasActiveFilters = filters.minPrice || filters.maxPrice || filters.minTemperature || filters.minRating;

  const totalResults = products.length + deals.length;

  return (
    <div className="page-container py-8 md:py-12">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl mb-2">
          {t('title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          Zapytanie: <span className="font-medium text-foreground">"{q}"</span>
          {!loading && (
            <span className="ml-2">
              ({totalResults} {totalResults === 1 ? 'wynik' : totalResults < 5 ? 'wyniki' : 'wyników'})
            </span>
          )}
        </p>
      </div>

      {/* Filters Toggle Button */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t('filters.advanced')}
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                {[filters.minPrice, filters.maxPrice, filters.minTemperature, filters.minRating].filter(Boolean).length}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                {t('filters.clearAll')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)}>
                <Bookmark className="h-4 w-4 mr-2" />
                {t('savedSearches.save')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Quick Filters */}
      <div className="mb-6 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">{t('filters.quickFilters.all')}:</span>
        {QUICK_FILTERS.map((preset, index) => {
          const Icon = getQuickFilterIcon(preset.name);
          return (
            <Badge
              key={index}
              variant="outline"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => applyQuickFilter(preset)}
            >
              <Icon className="h-3 w-3 mr-1" />
              {preset.name}
            </Badge>
          );
        })}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {t('filters.advanced')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Price Range */}
              <div className="space-y-2">
                <Label>Przedział cenowy (zł)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder={tActions('from')}
                    value={filters.minPrice || ''}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    placeholder={tActions('to')}
                    value={filters.maxPrice || ''}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Temperature (for deals) */}
              <div className="space-y-2">
                <Label>Minimalna temperatura (okazje)</Label>
                <Input
                  type="number"
                  placeholder="np. 100"
                  value={filters.minTemperature || ''}
                  onChange={(e) => setFilters({ ...filters, minTemperature: e.target.value ? Number(e.target.value) : undefined })}
                />
                <p className="text-xs text-muted-foreground">Pokaż tylko gorące okazje (≥100°)</p>
              </div>

              {/* Rating (for products) */}
              <div className="space-y-2">
                <Label>Minimalna ocena (produkty)</Label>
                <Select
                  value={filters.minRating?.toString() || 'all'}
                  onValueChange={(val) => setFilters({ ...filters, minRating: val === 'all' ? undefined : Number(val) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wszystkie oceny" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie oceny</SelectItem>
                    <SelectItem value="4">⭐ 4.0+</SelectItem>
                    <SelectItem value="4.5">⭐ 4.5+</SelectItem>
                    <SelectItem value="4.8">⭐ 4.8+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div className="space-y-2">
                <Label>Sortowanie</Label>
                <Select
                  value={filters.sortBy}
                  onValueChange={(val) => setFilters({ ...filters, sortBy: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Trafność</SelectItem>
                    <SelectItem value="price_asc">Cena: rosnąco</SelectItem>
                    <SelectItem value="price_desc">Cena: malejąco</SelectItem>
                    <SelectItem value="temperature">Temperatura (okazje)</SelectItem>
                    <SelectItem value="rating">Ocena (produkty)</SelectItem>
                    <SelectItem value="newest">Najnowsze</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[400px] rounded-lg" />
          ))}
        </div>
      ) : totalResults === 0 ? (
        <div className="text-center py-16">
          <p className="text-xl text-muted-foreground mb-4">
            {t('results.empty')}: "{q}"
          </p>
          <p className="text-sm text-muted-foreground">
            {t('results.emptyDescription')}
          </p>
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">
              Wszystkie ({totalResults})
            </TabsTrigger>
            <TabsTrigger value="products">
              Katalog produktów ({products.length})
            </TabsTrigger>
            <TabsTrigger value="deals">
              Okazje ({deals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-8">
            {products.length > 0 && (
              <div>
                <h2 className="font-headline text-2xl font-bold mb-4">🛍️ Katalog produktów</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product as any} viewMode="grid" />
                  ))}
                </div>
              </div>
            )}
            {deals.length > 0 && (
              <div>
                <h2 className="font-headline text-2xl font-bold mb-4">🔥 Okazje</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {deals.map((deal) => (
                    <DealCard key={deal.id} deal={deal} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="products">
            {products.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Brak produktów</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product as any} viewMode="grid" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deals">
            {deals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Brak okazji</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Save Search Dialog */}
      <SavedSearchDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        initialFilters={{
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          minTemperature: filters.minTemperature,
          keywords: q,
        } as SavedSearchFilters}
      />
    </div>
  );
}

