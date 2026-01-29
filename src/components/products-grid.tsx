'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Product } from '@/lib/types';
import { Grid, List } from 'lucide-react';
import { LazyProductCard } from '@/components/lazy-card';

interface ProductsGridProps {
  products: Product[];
  defaultView?: 'grid' | 'list';
  showViewToggle?: boolean;
  columnCountDesktop?: number;
  columnCountTablet?: number;
  columnCountMobile?: number;
}

/**
 * Uniwersalny komponent dla wyświetlania produktów
 * 
 * Identyczny pattern jak DealsGrid
 * - Wspólne tłumaczenia
 * - Responsive grid/list views
 */
export function ProductsGrid({
  products,
  defaultView = 'grid',
  showViewToggle = true,
  columnCountDesktop = 4,
  columnCountTablet = 2,
  columnCountMobile = 1,
}: ProductsGridProps) {
  const t = useTranslations('products');
  const [view, setView] = useState<'grid' | 'list'>(defaultView);

  const currentView = showViewToggle ? view : defaultView;

  return (
    <div className="w-full">
      {showViewToggle && (
        <div className="flex justify-end gap-2 mb-4">
          <Button
            variant={currentView === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setView('grid')}
            title={t('viewToggle.grid') || 'Grid'}
          >
            <Grid className="h-4 w-4" />
            <span className="sr-only">{t('viewToggle.grid') || 'Grid View'}</span>
          </Button>
          <Button
            variant={currentView === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setView('list')}
            title={t('viewToggle.list') || 'List'}
          >
            <List className="h-4 w-4" />
            <span className="sr-only">{t('viewToggle.list') || 'List View'}</span>
          </Button>
        </div>
      )}

      {currentView === 'grid' ? (
        <div className="grid gap-4 auto-rows-max" style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))`
        }}>
          {products.map((product) => (
            <div key={product.id}>
              <LazyProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id}>
              <LazyProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
