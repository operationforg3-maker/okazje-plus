import { notFound } from 'next/navigation';
import { getDealByIdTypesense, searchDealsTypesense } from '@/lib/search-server';
import { getProductCore } from '@/lib/data';
import { UXPreviewDealDetailClient } from './deal-detail-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  return { deal: raw, product, related };
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
