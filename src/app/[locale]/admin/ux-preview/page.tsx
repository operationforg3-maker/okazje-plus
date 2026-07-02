import { getHotDeals, getRecommendedProducts, getCategories } from '@/lib/data';
import { UXPreviewHomeClient } from './home-client';

export const revalidate = 0; // Disable caching for the preview page so updates are live

export default async function UXPreviewPage() {
  const [hotDeals, topProducts, categories] = await Promise.all([
    getHotDeals(8),
    getRecommendedProducts(8),
    getCategories(),
  ]);

  return (
    <UXPreviewHomeClient
      initialHotDeals={hotDeals}
      initialTopProducts={topProducts}
      categories={categories}
    />
  );
}
