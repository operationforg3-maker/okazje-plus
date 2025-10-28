'use client';

import { useEffect, useState } from 'react';
import { getHotDeals } from '@/lib/data';
import DealCard from '@/components/deal-card';
import { Deal } from '@/lib/types';

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    async function fetchDeals() {
      const hotDeals = await getHotDeals(20); // Pobierz 20 najgorętszych okazji
      setDeals(hotDeals);
    }

    fetchDeals();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl mb-8">
        Okazje
      </h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {deals.map(deal => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}
