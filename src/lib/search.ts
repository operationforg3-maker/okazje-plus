import { Deal, ProductCore } from '@/lib/types';

export type Suggestion = {
  type: 'product' | 'deal';
  id: string;
  label: string;
  subLabel?: string;
};

export type ProductSearchOptions = {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  limit?: number;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'newest';
  statusFilter?: 'approved' | 'waiting_room';
};

export type DealSearchOptions = {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  minTemperature?: number;
  limit?: number;
  sortBy?: 'relevance' | 'temperature' | 'hot' | 'price_asc' | 'price_desc' | 'newest' | 'discount_desc' | 'popularity';
  statusFilter?: 'approved' | 'waiting_room';
};

export async function searchProductsTypesense(
  q: string,
  opts: ProductSearchOptions = {}
): Promise<ProductCore[]> {
  try {
    const params = new URLSearchParams();
    params.set('q', q);
    params.set('type', 'products');
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.mainCategorySlug) params.set('mainCategorySlug', String(opts.mainCategorySlug));
    if (opts.subCategorySlug) params.set('subCategorySlug', String(opts.subCategorySlug));
    if (opts.subSubCategorySlug) params.set('subSubCategorySlug', String(opts.subSubCategorySlug));
    if (opts.minPrice !== undefined) params.set('minPrice', String(opts.minPrice));
    if (opts.maxPrice !== undefined) params.set('maxPrice', String(opts.maxPrice));
    if (opts.minRating !== undefined) params.set('minRating', String(opts.minRating));
    if (opts.statusFilter) params.set('status', opts.statusFilter);
    
    const baseUrl = typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') : '';
    const res = await fetch(`${baseUrl}/api/search?${params.toString()}`);
    if (!res.ok) return [];
    const body = await res.json();
    return body.products || [];
  } catch (e) {
    console.warn('searchProductsTypesense proxy fetch failed:', e);
    return [];
  }
}

export async function searchDealsTypesense(
  q: string,
  opts: DealSearchOptions = {}
): Promise<Deal[]> {
  try {
    const query = q.trim().length > 0 ? q : '*';
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('type', 'deals');
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.mainCategorySlug) params.set('mainCategorySlug', String(opts.mainCategorySlug));
    if (opts.subCategorySlug) params.set('subCategorySlug', String(opts.subCategorySlug));
    if (opts.subSubCategorySlug) params.set('subSubCategorySlug', String(opts.subSubCategorySlug));
    if (opts.minPrice !== undefined) params.set('minPrice', String(opts.minPrice));
    if (opts.maxPrice !== undefined) params.set('maxPrice', String(opts.maxPrice));
    if (opts.minTemperature !== undefined) params.set('minTemperature', String(opts.minTemperature));
    if (opts.sortBy) params.set('sort', opts.sortBy);
    if (opts.statusFilter) params.set('status', opts.statusFilter);

    const baseUrl = typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') : '';
    const res = await fetch(`${baseUrl}/api/search?${params.toString()}`);
    if (!res.ok) return [];
    const body = await res.json();
    return body.deals || [];
  } catch (e) {
    console.warn('searchDealsTypesense proxy fetch failed:', e);
    return [];
  }
}

export async function getAutocompleteSuggestions(q: string, limit = 5): Promise<Suggestion[]> {
  try {
    const params = new URLSearchParams();
    params.set('q', q);
    params.set('limit', String(limit));

    const baseUrl = typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') : '';
    const res = await fetch(`${baseUrl}/api/search/autocomplete?${params.toString()}`);
    if (!res.ok) return [];
    return (await res.json()) as Suggestion[];
  } catch (e) {
    console.warn('Autocomplete proxy failed:', e);
    return [];
  }
}

export async function getDealByIdTypesense(dealId: string): Promise<Deal | null> {
  if (!dealId) return null;
  try {
    const params = new URLSearchParams();
    params.set('q', '*');
    params.set('type', 'deals');
    params.set('limit', '1');
    params.set('dealId', dealId);

    const baseUrl = typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') : '';
    const res = await fetch(`${baseUrl}/api/search?${params.toString()}`);
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body.deals) && body.deals.length > 0 ? (body.deals[0] as Deal) : null;
  } catch (e) {
    console.warn('getDealByIdTypesense proxy fetch failed:', e);
    return null;
  }
}
