import { notFound } from 'next/navigation';
import { getProductWithDeals, getProductRatings } from '@/lib/data';
import { UXPreviewProductDetailClient } from './product-detail-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function resolveProduct(id: string) {
  if (!id || id.trim() === '') return null;

  const data = await getProductWithDeals(id);
  if (!data) return null;

  let recentRatings: any[] = [];
  try {
    recentRatings = await getProductRatings(id, 5);
  } catch {
    recentRatings = [];
  }

  return JSON.parse(JSON.stringify({
    product: data.product,
    deals: data.deals,
    recentRatings,
  }));
}

export default async function UXPreviewProductPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const data = await resolveProduct(id);
  if (!data) notFound();

  return (
    <UXPreviewProductDetailClient
      product={data.product}
      deals={data.deals}
      recentRatings={data.recentRatings}
    />
  );
}
