import typesenseClient from '@/lib/typesense';
import { Deal, ProductCore } from '@/lib/types';

export type ProductSearchOptions = {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  limit?: number;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'newest';
};

// Pełnotekstowe wyszukiwanie produktów w Typesense z filtrowaniem po kategoriach
// M6: Returns ProductCore objects (not legacy Product)
export async function searchProductsTypesense(
  q: string,
  opts: ProductSearchOptions = {}
): Promise<ProductCore[]> {
  const { 
    mainCategorySlug, 
    subCategorySlug, 
    subSubCategorySlug,
    minPrice, 
    maxPrice, 
    minRating,
    sortBy = 'relevance',
    limit = 50 
  } = opts;

  // If running in browser, prefer server-side API (centralized caching / rate-limiting)
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('type', 'products');
      params.set('limit', String(limit));
      if (mainCategorySlug) params.set('mainCategorySlug', String(mainCategorySlug));
      if (subCategorySlug) params.set('subCategorySlug', String(subCategorySlug));
      if (subSubCategorySlug) params.set('subSubCategorySlug', String(subSubCategorySlug));
      if (minPrice !== undefined) params.set('minPrice', String(minPrice));
      if (maxPrice !== undefined) params.set('maxPrice', String(maxPrice));
      if (minRating !== undefined) params.set('minRating', String(minRating));
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) return [];
      const body = await res.json();
      return body.products || [];
    } catch (e) {
      console.warn('Client-side search proxy failed:', e);
    }
  }

  // final.md: public reads should go through Typesense, no Firestore fallback.
  if (!typesenseClient) {
    console.warn('Typesense client unavailable for product search. Returning empty result.');
    return [];
  }

  const filters: string[] = [];
  if (mainCategorySlug) filters.push(`mainCategorySlug:=${mainCategorySlug}`);
  if (subCategorySlug) filters.push(`subCategorySlug:=${subCategorySlug}`);
  if (subSubCategorySlug) filters.push(`subSubCategorySlug:=${subSubCategorySlug}`);
  if (minPrice !== undefined) filters.push(`price:>=${minPrice}`);
  if (maxPrice !== undefined) filters.push(`price:<=${maxPrice}`);
  if (minRating !== undefined) filters.push(`ratingCard.average:>=${minRating}`);
  filters.push(`status:=approved`);

  // Sortowanie
  let sort_by = '';
  switch (sortBy) {
    case 'price_asc':
      sort_by = 'price:asc';
      break;
    case 'price_desc':
      sort_by = 'price:desc';
      break;
    case 'rating':
      sort_by = 'ratingCard.average:desc';
      break;
    case 'popularity':
      sort_by = 'marketing.ordersCount:desc';
      break;
    case 'newest':
      sort_by = 'createdAt:desc';
      break;
    default:
      sort_by = '_text_match:desc'; // relevance
  }

  try {
    const res = await typesenseClient
      .collections('products')
      .documents()
      .search({
        q,
        query_by: 'name,description',
        filter_by: filters.join(' && '),
        sort_by,
        per_page: limit,
      }, {});

    // M6: Typesense index contains ProductCore documents, return with id field
    const hits = (res.hits || []).map((h: any) => ({ id: h.document.id, ...h.document })) as ProductCore[];
    return hits;
  } catch (err) {
    console.warn('Typesense search failed:', err);
    return [];
  }
}

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

export async function searchDealsTypesense(
  q: string,
  opts: DealSearchOptions = {}
): Promise<Deal[]> {
  const { 
    mainCategorySlug, 
    subCategorySlug, 
    subSubCategorySlug,
    minPrice,
    maxPrice,
    minTemperature,
    sortBy = 'relevance',
    limit = 50,
    statusFilter = 'approved',
  } = opts;
  const query = q.trim().length > 0 ? q : '*';
  
  // If running in browser, prefer server-side API (centralized caching / rate-limiting)
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams();
      params.set('q', query);
      params.set('type', 'deals');
      params.set('limit', String(limit));
      if (mainCategorySlug) params.set('mainCategorySlug', String(mainCategorySlug));
      if (subCategorySlug) params.set('subCategorySlug', String(subCategorySlug));
      if (subSubCategorySlug) params.set('subSubCategorySlug', String(subSubCategorySlug));
      if (minPrice !== undefined) params.set('minPrice', String(minPrice));
      if (maxPrice !== undefined) params.set('maxPrice', String(maxPrice));
      if (minTemperature !== undefined) params.set('minTemperature', String(minTemperature));
      if (sortBy) params.set('sort', sortBy);
      params.set('status', statusFilter);
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) return [];
      const body = await res.json();
      return body.deals || [];
    } catch (e) {
      console.warn('Client-side search proxy failed:', e);
    }
  }

  // final.md: public reads should go through Typesense, no Firestore fallback.
  if (!typesenseClient) {
    console.warn('Typesense client unavailable for deal search. Returning empty result.');
    return [];
  }
  
  const filters: string[] = [];
  if (mainCategorySlug) filters.push(`mainCategorySlug:=${mainCategorySlug}`);
  if (subCategorySlug) filters.push(`subCategorySlug:=${subCategorySlug}`);
  if (subSubCategorySlug) filters.push(`subSubCategorySlug:=${subSubCategorySlug}`);
  if (minPrice !== undefined) filters.push(`price:>=${minPrice}`);
  if (maxPrice !== undefined) filters.push(`price:<=${maxPrice}`);
  if (minTemperature !== undefined) filters.push(`temperature:>=${minTemperature}`);
  if (statusFilter === 'waiting_room') {
    // final.md compatibility: support both legacy pending and canonical poczekalnia labels.
    filters.push('status:=[pending,poczekalnia]');
  } else {
    filters.push('status:=approved');
  }
  
  // Sortowanie
  let sort_by = '';
  switch (sortBy) {
    case 'temperature':
    case 'hot':
      sort_by = 'temperature:desc';
      break;
    case 'price_asc':
      sort_by = 'price:asc';
      break;
    case 'price_desc':
      sort_by = 'price:desc';
      break;
    case 'newest':
      sort_by = 'postedAt:desc';
      break;
    case 'popularity':
      sort_by = 'voteCount:desc';
      break;
    case 'discount_desc':
      sort_by = 'discountPercent:desc';
      break;
    default:
      sort_by = '_text_match:desc'; // relevance
  }
  
  try {
    const res = await typesenseClient.collections('deals').documents().search({
      q: query,
      query_by: 'title,description,postedBy',
      filter_by: filters.join(' && '),
      sort_by,
      per_page: limit,
    }, {});
    const hits = (res.hits || []).map((h: any) => ({ id: h.document.id, ...h.document })) as Deal[];
    return hits;
  } catch (err) {
    console.warn('Typesense deals search failed:', err);
    return [];
  }
}

export type Suggestion = {
  type: 'product' | 'deal';
  id: string;
  label: string;
  subLabel?: string;
};

export async function getAutocompleteSuggestions(q: string, limit = 5): Promise<Suggestion[]> {
  // If running in browser, always use server-side autocomplete endpoint
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('limit', String(limit));
      const res = await fetch(`/api/search/autocomplete?${params.toString()}`);
      if (!res.ok) return [];
      return (await res.json()) as Suggestion[];
    } catch (e) {
      console.warn('Autocomplete proxy failed:', e);
      return [];
    }
  }

  // final.md: public reads should go through Typesense, no Firestore fallback.
  if (!typesenseClient) {
    console.warn('Typesense client unavailable for autocomplete. Returning empty result.');
    return [];
  }

  try {
    const searches = {
      searches: [
        { collection: 'products', q, query_by: 'name,description', per_page: limit, highlight_full_fields: 'name', prefix: true },
        { collection: 'deals', q, query_by: 'title,description', per_page: limit, highlight_full_fields: 'title', prefix: true },
      ],
    } as any;
    const res = await (typesenseClient as any).multiSearch.perform(searches, {});
    const out: Suggestion[] = [];
    for (const r of res.results || []) {
      const isDeal = r.request_params.collection === 'deals';
      for (const h of r.hits || []) {
        const doc = h.document;
        out.push({
          type: isDeal ? 'deal' : 'product',
          id: doc.id,
          label: isDeal ? doc.title : doc.name,
          subLabel: isDeal ? doc.description : doc.description,
        });
      }
    }
    return out;
  } catch (e) {
    console.warn('Typesense autocomplete failed:', e);
    return [];
  }
}

// final.md alignment: public offer reads should use Typesense.
export async function getDealByIdTypesense(dealId: string): Promise<Deal | null> {
  if (!dealId) return null;

  // If running in browser, go through API route.
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams();
      params.set('q', '*');
      params.set('type', 'deals');
      params.set('limit', '1');
      params.set('dealId', dealId);
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) return null;
      const body = await res.json();
      return Array.isArray(body.deals) && body.deals.length > 0 ? (body.deals[0] as Deal) : null;
    } catch (e) {
      console.warn('Client-side getDealByIdTypesense proxy failed:', e);
      return null;
    }
  }

  if (!typesenseClient) {
    console.warn('Typesense client unavailable for getDealByIdTypesense. Returning null.');
    return null;
  }

  try {
    const res = await typesenseClient.collections('deals').documents().search({
      q: '*',
      query_by: 'title,description,postedBy',
      filter_by: `id:=${dealId} && status:=[approved,pending,poczekalnia]`,
      per_page: 1,
    }, {});
    const firstHit = (res.hits || [])[0] as any;
    if (!firstHit?.document) return null;
    return { id: firstHit.document.id, ...firstHit.document } as Deal;
  } catch (e) {
    console.warn('Typesense getDealById failed:', e);
    return null;
  }
}
