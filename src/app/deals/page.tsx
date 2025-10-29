'use client';

import { useEffect, useState } from 'react';
import { getHotDeals } from '@/lib/data';
import { Deal } from '@/lib/types';
import { DealsList } from '@/components/deals-list';

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
      <DealsList deals={deals} />
    </div>
  );
}
