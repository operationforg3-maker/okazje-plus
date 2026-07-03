import { getHotDeals, getRecommendedProducts, getCategories } from '@/lib/data';
import { UXPreviewV2Client } from './v2-client';

export const revalidate = 0;

export default async function UXPreviewV2Page() {
  const [hotDeals, topProducts, categories] = await Promise.all([
    getHotDeals(12),
    getRecommendedProducts(8),
    getCategories(),
  ]);

  return (
    <UXPreviewV2Client
      initialHotDeals={hotDeals}
      initialTopProducts={topProducts}
      categories={categories}
    />
  );
}
