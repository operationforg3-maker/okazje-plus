'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import DealCard from '@/components/deal-card';
import DealListCard from '@/components/deal-list-card'; // Import the new component
import { Deal } from '@/lib/types';
import { Grid, List } from 'lucide-react';

interface DealsListProps {
  deals: Deal[];
}

export function DealsList({ deals }: DealsListProps) {
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <div>
      <div className="flex justify-end space-sm mb-4">
        <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('grid')}>
          <Grid className="h-4 w-4" />
          <span className="sr-only">Grid View</span>
        </Button>
        <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('list')}>
          <List className="h-4 w-4" />
          <span className="sr-only">List View</span>
        </Button>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 space-lg">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col space-md">
          {deals.map((deal) => (
            <DealListCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
