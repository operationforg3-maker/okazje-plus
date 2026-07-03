import { notFound } from 'next/navigation';
import { getDealByIdTypesense, searchDealsTypesense } from '@/lib/search-server';
import { getProductCore } from '@/lib/data';
import { UXPreviewDealDetailClient } from './deal-detail-client';

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

async function resolveDeal(id: string) {
  const raw = await getDealByIdTypesense(id);
  if (!raw) return null;

  const productId =
    (raw as any).productCoreId ||
    (raw as any).productId ||
    (raw as any).linkedProductIds?.[0];
  const product = productId ? await getProductCore(productId) : null;

  // Get related deals from same sub-category
  const allHot = await searchDealsTypesense('*', { limit: 20, sortBy: 'hot', statusFilter: 'approved' });
  const related = allHot
    .filter((d) => d.id !== id)
    .filter((d) => {
      if ((raw as any).subCategorySlug && (d as any).subCategorySlug) {
        return (d as any).subCategorySlug === (raw as any).subCategorySlug;
      }
      return (d as any).mainCategorySlug === (raw as any).mainCategorySlug;
    })
    .slice(0, 6);

  return { 
    deal: sanitizeData(raw), 
    product: sanitizeData(product), 
    related: sanitizeData(related) 
  };
}

export default async function UXPreviewDealPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const data = await resolveDeal(id);
  if (!data) notFound();

  return (
    <UXPreviewDealDetailClient
      deal={data.deal as any}
      product={data.product as any}
      relatedDeals={data.related as any[]}
    />
  );
}
