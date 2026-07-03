import { getHotDeals, getRecommendedProducts, getCategories } from '@/lib/data';
import { UXPreviewV1Client } from './v1-client';

export const revalidate = 0;

export default async function UXPreviewV1Page() {
  const [hotDeals, topProducts, categories] = await Promise.all([
    getHotDeals(12),
    getRecommendedProducts(6),
    getCategories(),
  ]);

  return (
    <UXPreviewV1Client
      initialHotDeals={hotDeals}
      initialTopProducts={topProducts}
      categories={categories}
    />
  );
}
