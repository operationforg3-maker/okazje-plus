import { getHotDeals, getRecommendedProducts, getCategories } from '@/lib/data';
import { UXPreviewV4Client } from './v4-client';

export const revalidate = 0;

export default async function UXPreviewV4Page() {
  const [hotDeals, topProducts, categories] = await Promise.all([
    getHotDeals(16),
    getRecommendedProducts(8),
    getCategories(),
  ]);

  return (
    <UXPreviewV4Client
      initialHotDeals={hotDeals}
      initialTopProducts={topProducts}
      categories={categories}
    />
  );
}
