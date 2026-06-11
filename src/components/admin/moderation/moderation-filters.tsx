'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Category } from '@/lib/types';

interface ModerationFiltersProps {
  type: 'deals' | 'products';
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  categories: Category[];
  selectedMainCategory: string;
  setSelectedMainCategory: (val: string) => void;
  selectedSubCategory: string;
  setSelectedSubCategory: (val: string) => void;
  selectedSubSubCategory: string;
  setSelectedSubSubCategory: (val: string) => void;
  itemsCount: number;
}

export function ModerationFilters({
  type,
  statusFilter,
  setStatusFilter,
  categories,
  selectedMainCategory,
  setSelectedMainCategory,
  selectedSubCategory,
  setSelectedSubCategory,
  selectedSubSubCategory,
  setSelectedSubSubCategory,
  itemsCount,
}: ModerationFiltersProps) {
  const t = useTranslations('admin.common');

  const getLocalizedTitle = (value: any): string => {
    if (!value) return 'Bez tytułu';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.pl || value.en || value.de || 'Bez tytułu';
    }
    return 'Bez tytułu';
  };

  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-medium text-sm">Filtruj po statusie:</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Wybierz status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">🌐 Wszystkie statusy</SelectItem>
            <SelectItem value="pending">
              ⏳ Poczekalnia ({type === 'deals' ? 'pending + draft' : 'pending_approval + draft'})
            </SelectItem>
            <SelectItem value="approved">✅ Zatwierdzone</SelectItem>
            <SelectItem value="draft">📝 Szkic</SelectItem>
            {type === 'products' && (
              <SelectItem value="pending_approval">⏰ Oczekuje na akceptację</SelectItem>
            )}
            <SelectItem value="rejected">❌ Odrzucone</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">
          {itemsCount} {type === 'deals' ? 'deali' : 'produktów'}
        </Badge>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-medium text-sm">Filtruj po kategorii:</span>
        <Select
          value={selectedMainCategory || 'all'}
          onValueChange={(val) => {
            setSelectedMainCategory(val === 'all' ? '' : val);
            setSelectedSubCategory('');
            setSelectedSubSubCategory('');
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Kategoria główna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie kategorie</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.slug} value={cat.slug}>
                {getLocalizedTitle(cat.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedMainCategory && (
          <>
            <Select
              value={selectedSubCategory || 'all'}
              onValueChange={(val) => {
                setSelectedSubCategory(val === 'all' ? '' : val);
                setSelectedSubSubCategory('');
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('subcategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie podkategorie</SelectItem>
                {categories
                  .find((c) => c.slug === selectedMainCategory)
                  ?.subcategories?.map((sub) => (
                    <SelectItem key={sub.slug} value={sub.slug}>
                      {getLocalizedTitle(sub.name)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {selectedSubCategory && (
              <Select
                value={selectedSubSubCategory || 'all'}
                onValueChange={(val) => setSelectedSubSubCategory(val === 'all' ? '' : val)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Pod-podkategoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie pod-podkategorie</SelectItem>
                  {categories
                    .find((c) => c.slug === selectedMainCategory)
                    ?.subcategories?.find((s) => s.slug === selectedSubCategory)
                    ?.subcategories?.map((subsub) => (
                      <SelectItem key={subsub.slug} value={subsub.slug}>
                        {getLocalizedTitle(subsub.name)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </>
        )}
      </div>
    </div>
  );
}
