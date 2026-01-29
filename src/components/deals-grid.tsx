'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Deal } from '@/lib/types';
import { Grid, List } from 'lucide-react';
import { LazyDealCard } from '@/components/lazy-card';

interface DealsGridProps {
  deals: Deal[];
  defaultView?: 'grid' | 'list';
  showViewToggle?: boolean;
  columnCountDesktop?: number;
  columnCountTablet?: number;
  columnCountMobile?: number;
}

/**
 * Uniwersalny komponent dla wyświetlania okazji
 * 
 * Cechy:
 * - Jedynie źródło UI (bez duplikacji kodu)
 * - Wspólne tłumaczenia (PL)
 * - Responsive grid/list views
 * 
 * Użycie:
 * <DealsGrid deals={deals} />
 * <DealsGrid deals={deals} showViewToggle={false} />
 */
export function DealsGrid({
  deals,
  defaultView = 'grid',
  showViewToggle = true,
  columnCountDesktop = 4,
  columnCountTablet = 2,
  columnCountMobile = 1,
}: DealsGridProps) {
  const t = useTranslations('deals');
  const [view, setView] = useState<'grid' | 'list'>(defaultView);

  // Jeśli showViewToggle=false, wymuś defaultView
  const currentView = showViewToggle ? view : defaultView;

  return (
    <div className="w-full">
      {/* Toggle buttons - tylko jeśli showViewToggle=true */}
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

      {/* Grid View */}
      {currentView === 'grid' ? (
        <div className="grid gap-4 auto-rows-max" style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))`
        }}>
          {deals.map((deal) => (
            <div key={deal.id}>
              <LazyDealCard deal={deal} />
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {deals.map((deal) => (
            <div key={deal.id}>
              <LazyDealCard deal={deal} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
