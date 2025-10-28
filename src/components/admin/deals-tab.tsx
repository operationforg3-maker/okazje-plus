'use client';

import { useEffect, useState } from 'react';
import { getHotDeals } from "@/lib/data";
import { Deal } from '@/lib/types';

export function DealsTab() {
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    async function fetchDeals() {
      const hotDeals = await getHotDeals(50); // Pobierz 50 najnowszych okazji do panelu admina
      setDeals(hotDeals);
    }

    fetchDeals();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Zarządzaj Okazjami</h2>
      {/* TODO: Add deal management functionality */}
      <ul>
        {deals.map(deal => (
          <li key={deal.id}>{deal.title}</li>
        ))}
      </ul>
    </div>
  );
}