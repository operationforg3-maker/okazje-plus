'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentSort = searchParams.get('sort') || 'newest';

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="w-[180px]">
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger>
          <SelectValue placeholder="Sortowanie" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Najnowsze</SelectItem>
          <SelectItem value="popularity">Najpopularniejsze</SelectItem>
          <SelectItem value="price_asc">Cena: rosnąco</SelectItem>
          <SelectItem value="price_desc">Cena: malejąco</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
