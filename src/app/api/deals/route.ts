import { NextResponse } from 'next/server';
import { getDealsByFilters, getDealsCount } from '@/lib/data';
import { searchDealsTypesense } from '@/lib/search';
import { retryWithBackoff } from '@/lib/offline-utils';

/**
 * API endpoint that returns paginated deal data.
 * Query parameters:
 *   - page: page number (1-indexed, default 1)
 *   - size: items per page (default 20)
 *   - sort: sort option (hot, newest, price_asc, price_desc, discount)
 *   - status: deal status (approved, waiting_room)
 *   - mainCategorySlug, subCategorySlug, subSubCategorySlug, q (search term)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const size = Math.max(1, parseInt(url.searchParams.get('size') ?? '20', 10));
  const sort = (url.searchParams.get('sort') as any) ?? 'hot';
  const status = (url.searchParams.get('status') as any) ?? 'approved';
  const q = url.searchParams.get('q') ?? '';
  const mainCategorySlug = url.searchParams.get('mainCategorySlug') ?? undefined;
  const subCategorySlug = url.searchParams.get('subCategorySlug') ?? undefined;
  const subSubCategorySlug = url.searchParams.get('subSubCategorySlug') ?? undefined;
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');
  const minRating = url.searchParams.get('minRating');
  const minTemperature = url.searchParams.get('minTemperature');
  const sources = url.searchParams.get('sources');
  const discountOnly = url.searchParams.get('discountOnly') === 'true';

  // Try Typesense search first if there is a query or we need sorting.
  let results: any[] = [];
  try {
    if (q.length > 0 || sort) {
      const typesenseResults = await retryWithBackoff(() =>
        searchDealsTypesense(q.length > 0 ? q : '*', {
          mainCategorySlug,
          subCategorySlug,
          subSubCategorySlug,
          limit: size,
          page,
          sortBy: sort as any,
          statusFilter: status,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          minTemperature: minTemperature ? Number(minTemperature) : undefined,
        })
      , 2, 500);
      results = typesenseResults || [];
    }
  } catch (e) {
    // ignore, fallback to Firestore
  }

  if (results.length === 0) {
    // Fallback to Firestore
    const filters: any = {
      statusFilter: status,
    } as any;
    if (mainCategorySlug) filters.categoryId = mainCategorySlug;
    if (subCategorySlug) filters.subCategorySlug = subCategorySlug;
    if (subSubCategorySlug) filters.subSubCategorySlug = subSubCategorySlug;
    if (q) filters.searchTerm = q;

    if (minPrice !== null && maxPrice !== null) {
      filters.priceRange = { min: Number(minPrice), max: Number(maxPrice) };
    } else {
      if (minPrice !== null) filters.priceLimitMin = Number(minPrice);
      if (maxPrice !== null) filters.priceLimitMax = Number(maxPrice);
    }
    if (minRating !== null) filters.minRating = Number(minRating);
    if (minTemperature !== null) filters.minTemperature = Number(minTemperature);
    if (sources) filters.sources = sources.split(',') as any;
    if (discountOnly) filters.discountOnly = true;

    const deals = await getDealsByFilters(filters, sort as any, size);
    // Firestore fetch does not support offset directly; we slice manually.
    const offset = (page - 1) * size;
    results = deals.slice(offset, offset + size);
  }

  const totalCount = await getDealsCount({
    categoryId: mainCategorySlug,
    subCategorySlug: subCategorySlug,
    subSubCategorySlug: subSubCategorySlug,
    status: status === 'waiting_room' ? 'poczekalnia' : 'approved',
  });

  const responseBody = {
    deals: results,
    pagination: {
      page,
      size,
      total: totalCount,
      hasMore: page * size < totalCount,
    },
  };

  return NextResponse.json(responseBody);
}
