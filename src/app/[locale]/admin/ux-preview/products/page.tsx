import { getRecommendedProducts } from '@/lib/data';
import { UXPreviewProductsClient } from './products-client';

export const revalidate = 0;

export default async function UXPreviewProductsPage() {
  const initialProducts = await getRecommendedProducts(12);

  return (
    <UXPreviewProductsClient initialProducts={initialProducts} />
  );
}
