export const dynamic = 'force-dynamic';

import { getHotDeals, getRecommendedProducts } from '@/lib/data';
import { Deal, Product } from '@/lib/types';
import HomeClient from '@/components/home-client';

export default async function Home() {
  // Server-side data fetching to avoid bundling server-only modules in client
  const [hotDeals, recommendedProducts]: [Deal[], Product[]] = await Promise.all([
    getHotDeals(4),
    getRecommendedProducts(4),
  ]);

  return (
    <HomeClient initialHotDeals={hotDeals} initialRecommendedProducts={recommendedProducts} />
  );
}
