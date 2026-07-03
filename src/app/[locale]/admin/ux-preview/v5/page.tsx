import { getHotDeals, getRecommendedProducts, getCategories } from '@/lib/data';
import { UXPreviewV5Client } from './v5-client';

export const revalidate = 0;

export default async function UXPreviewV5Page() {
  const [hotDeals, topProducts, categories] = await Promise.all([
    getHotDeals(20),
    getRecommendedProducts(8),
    getCategories(),
  ]);

  return (
    <UXPreviewV5Client
      initialHotDeals={hotDeals}
      initialTopProducts={topProducts}
      categories={categories}
    />
  );
}
