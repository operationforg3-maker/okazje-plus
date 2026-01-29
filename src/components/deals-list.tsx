'use client';

import { Deal } from '@/lib/types';
import { DealsGrid } from '@/components/deals-grid';

interface DealsListProps {
  deals: Deal[];
}

export function DealsList({ deals }: DealsListProps) {
  return <DealsGrid deals={deals} showViewToggle={true} columnCountDesktop={3} />;
}
