import { getHotDeals } from '@/lib/data';
import { UXPreviewDealsClient } from './deals-client';

export const revalidate = 0;

export default async function UXPreviewDealsPage() {
  const initialDeals = await getHotDeals(12);

  return (
    <UXPreviewDealsClient initialDeals={initialDeals} />
  );
}
