import { notFound } from 'next/navigation';
import { getProductWithDeals, getProductRatings } from '@/lib/data';
import { UXPreviewProductDetailClient } from './product-detail-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sanitizeData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof (obj as any).toDate === 'function') {
    return (obj as any).toDate().toISOString() as any;
  }

  if (typeof (obj as any).seconds === 'number' && typeof (obj as any).nanoseconds === 'number') {
    return new Date((obj as any).seconds * 1000).toISOString() as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item)) as any;
  }

  if (typeof obj === 'object') {
    const res: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key === 'embedding') continue;
        res[key] = sanitizeData(obj[key]);
      }
    }
    return res;
  }

  return obj;
}

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

  return {
    product: sanitizeData(data.product),
    deals: sanitizeData(data.deals),
    recentRatings: sanitizeData(recentRatings),
  };
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
