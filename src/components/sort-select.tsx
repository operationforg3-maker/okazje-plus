'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('filters');

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
          <SelectValue placeholder={t('sort')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">{t('sortOptions.newest')}</SelectItem>
          <SelectItem value="popularity">{t('sortOptions.popularity')}</SelectItem>
          <SelectItem value="price_asc">{t('sortOptions.price_asc')}</SelectItem>
          <SelectItem value="price_desc">{t('sortOptions.price_desc')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
