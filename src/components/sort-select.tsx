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
import { SORT_OPTIONS } from '@/lib/filter-config';

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
    <div className="w-[180px] h-10">
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger className="h-10" aria-label={t('sort')}>
          <SelectValue placeholder={t('sort')} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORT_OPTIONS).map(([key]) => (
            <SelectItem key={key} value={key}>
              {t(`sortOptions.${key}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
