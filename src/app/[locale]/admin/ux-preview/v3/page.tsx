import { getHotDeals, getRecommendedProducts, getCategories } from '@/lib/data';
import { UXPreviewV3Client } from './v3-client';

export const revalidate = 0;

export default async function UXPreviewV3Page() {
  const [hotDeals, topProducts, categories] = await Promise.all([
    getHotDeals(12),
    getRecommendedProducts(6),
    getCategories(),
  ]);

  return (
    <UXPreviewV3Client
      initialHotDeals={hotDeals}
      initialTopProducts={topProducts}
      categories={categories}
    />
  );
}
