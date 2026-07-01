/**
 * Hook: useCardBaseState
 * 
 * Konsoliduje wszytkie wspólne state'y dla Deal/Product kartek
 * Pozwala:
 * - Zmniejszyć deal-card.tsx z 1055 → 300 linii
 * - Zmniejszyć product-card.tsx z 574 → 250 linii
 * - Uniknąć duplikacji logiki
 * 
 * Usage:
 * const state = useCardBaseState(deal);
 * state.formatPrice(deal.price)
 * state.toggleFavorite()
 */

import { useMemo } from 'react';
import { Deal, Product } from '@/lib/types';
import { useCurrency } from '@/lib/unified-currency';
import { useContentLanguage } from '@/hooks/use-content-language';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/hooks/use-favorites';
import { useComparison } from '@/components/deal-comparison-tool';
import { useTranslations } from 'next-intl';

interface CardBaseState {
  // Formatting
  formatPrice: (price: number) => string;
  getText: (key: string, defaultVal?: string) => string;
  
  // User & Auth
  user: any;
  isAdmin: boolean;
  
  // Favorites
  isFavorited: boolean;
  isFavoriteLoading: boolean;
  toggleFavorite: () => Promise<void>;
  
  // Comparison
  addToComparison: (item: Deal | Product) => void;
  
  // Translations
  t: (key: string, values?: any) => string;
}

export function useCardBaseState(
  item: Deal | Product | any,
  type: 'deal' | 'product' = 'deal',
  options?: { disableInitialFavoriteCheck?: boolean }
): CardBaseState {
  const { formatPrice } = useCurrency();
  const { getText } = useContentLanguage();
  const { user } = useAuth();
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(
    item.id, 
    type,
    options?.disableInitialFavoriteCheck
  );
  const { addToComparison } = useComparison();
  const t = useTranslations('common');
  
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator';
  
  return useMemo(() => ({
    formatPrice,
    getText,
    user,
    isAdmin,
    isFavorited,
    isFavoriteLoading,
    toggleFavorite,
    addToComparison,
    t,
  }), [
    formatPrice,
    getText,
    user,
    isAdmin,
    isFavorited,
    isFavoriteLoading,
    toggleFavorite,
    addToComparison,
    t
  ]);
}
