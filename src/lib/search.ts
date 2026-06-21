import typesenseClient from '@/lib/typesense';
import { Deal, ProductCore } from '@/lib/types';
import { collection, doc, documentId, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DEAL_IMAGE_FALLBACK = '/icon_okazjeplus.svg';
const MAX_TYPESENSE_PAGE_SIZE = 250;

const clampTypesensePageSize = (value?: number, fallback = 50): number => {
  const raw = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(MAX_TYPESENSE_PAGE_SIZE, Math.max(1, raw));
};

function resolveImageCandidate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = resolveImageCandidate(item);
      if (resolved) return resolved;
    }
    return null;
  }
  if (typeof value === 'object') {
    return (
      resolveImageCandidate((value as any).src)
      || resolveImageCandidate((value as any).url)
      || resolveImageCandidate((value as any).image)
      || resolveImageCandidate((value as any).imageUrl)
    );
  }
  return null;
}

function resolveDealImage(record: any): string {
  return (
    resolveImageCandidate(record?.image)
    || resolveImageCandidate(record?.imageUrl)
    || resolveImageCandidate(record?.mainImage)
    || resolveImageCandidate(record?.product_main_image_url)
    || resolveImageCandidate(record?.thumbnail)
    || resolveImageCandidate(record?.images)
    || resolveImageCandidate(record?.gallery)
    || resolveImageCandidate(record?.metadata?.image)
    || resolveImageCandidate(record?.metadata?.imageUrl)
    || resolveImageCandidate(record?.metadata?.mainImage)
    || resolveImageCandidate(record?.importMetadata?.image)
    || resolveImageCandidate(record?.importMetadata?.imageUrl)
    || resolveImageCandidate(record?.importMetadata?.mainImage)
    || DEAL_IMAGE_FALLBACK
  );
}

function chunkIds(ids: string[], chunkSize = 30): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  return chunks;
}

async function hydrateFallbackDealImages(deals: Deal[]): Promise<Deal[]> {
  const idsToHydrate = deals
    .filter((deal) => !deal?.image || deal.image === DEAL_IMAGE_FALLBACK)
    .map((deal) => String(deal.id || ''))
    .filter(Boolean);

  if (idsToHydrate.length === 0) return deals;

  const batches = chunkIds([...new Set(idsToHydrate)]);
  const resolved = new Map<string, string>();

  await Promise.all(
    batches.map(async (batch) => {
      const snap = await getDocs(query(collection(db, 'deals'), where(documentId(), 'in', batch)));
      snap.docs.forEach((docSnap) => {
        const image = resolveDealImage(docSnap.data());
        if (image && image !== DEAL_IMAGE_FALLBACK) {
          resolved.set(docSnap.id, image);
        }
      });
    })
  );

  if (resolved.size === 0) return deals;

  return deals.map((deal) => {
    const hydratedImage = resolved.get(String(deal.id || ''));
    if (!hydratedImage) return deal;
    return { ...deal, image: hydratedImage };
  });
}

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
    limit = 50,
    statusFilter = 'approved',
  } = opts;
  const safeLimit = clampTypesensePageSize(limit, 50);

  // If running in browser, prefer server-side API (centralized caching / rate-limiting)
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('type', 'products');
      params.set('limit', String(safeLimit));
      if (mainCategorySlug) params.set('mainCategorySlug', String(mainCategorySlug));
      if (subCategorySlug) params.set('subCategorySlug', String(subCategorySlug));
      if (subSubCategorySlug) params.set('subSubCategorySlug', String(subSubCategorySlug));
      if (minPrice !== undefined) params.set('minPrice', String(minPrice));
      if (maxPrice !== undefined) params.set('maxPrice', String(maxPrice));
      if (minRating !== undefined) params.set('minRating', String(minRating));
      params.set('status', statusFilter);
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
    console.warn('Typesense client unavailable for product search. Falling back to Firestore.');
    try {
      const { getProductCoresByFiltersData } = await import('@/lib/data/products');
      return await getProductCoresByFiltersData(
        {
          categoryId: mainCategorySlug,
          subCategorySlug,
          subSubCategorySlug,
          priceLimitMin: minPrice,
          priceLimitMax: maxPrice,
          minRating,
          searchTerm: q !== '*' ? q : undefined,
          statusFilter,
        },
        sortBy as any,
        safeLimit
      );
    } catch (fallbackErr) {
      console.error('Firestore fallback for searchProductsTypesense failed:', fallbackErr);
      return [];
    }
  }

  const filters: string[] = [];
  if (mainCategorySlug) filters.push(`mainCategorySlug:=${mainCategorySlug}`);
  if (subCategorySlug) filters.push(`subCategorySlug:=${subCategorySlug}`);
  if (subSubCategorySlug) filters.push(`subSubCategorySlug:=${subSubCategorySlug}`);
  if (minPrice !== undefined) filters.push(`price:>=${minPrice}`);
  if (maxPrice !== undefined) filters.push(`price:<=${maxPrice}`);
  if (minRating !== undefined) filters.push(`ratingCard.average:>=${minRating}`);
  if (statusFilter === 'waiting_room') {
    filters.push('status:=[pending_approval,approval,pending,poczekalnia]');
  } else {
    filters.push('status:=approved');
  }

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
        per_page: safeLimit,
      }, {});

    // M6: Typesense index contains ProductCore documents, return with id field
    const hits = (res.hits || []).map((h: any) => ({ id: h.document.id, ...h.document })) as ProductCore[];
    return hits;
  } catch (err) {
    console.warn('Typesense search failed. Falling back to Firestore:', err);
    try {
      const { getProductCoresByFiltersData } = await import('@/lib/data/products');
      return await getProductCoresByFiltersData(
        {
          categoryId: mainCategorySlug,
          subCategorySlug,
          subSubCategorySlug,
          priceLimitMin: minPrice,
          priceLimitMax: maxPrice,
          minRating,
          searchTerm: q !== '*' ? q : undefined,
          statusFilter,
        },
        sortBy as any,
        safeLimit
      );
    } catch (fallbackErr) {
      console.error('Firestore fallback for searchProductsTypesense failed:', fallbackErr);
      return [];
    }
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
  const safeLimit = clampTypesensePageSize(limit, 50);
  const query = q.trim().length > 0 ? q : '*';
  
  // If running in browser, prefer server-side API (centralized caching / rate-limiting)
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams();
      params.set('q', query);
      params.set('type', 'deals');
      params.set('limit', String(safeLimit));
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
    console.warn('Typesense client unavailable for deal search. Falling back to Firestore.');
    try {
      const { getDealsByFiltersData } = await import('@/lib/data/deals');
      return await getDealsByFiltersData(
        {
          categoryId: mainCategorySlug,
          subCategorySlug,
          subSubCategorySlug,
          priceLimitMin: minPrice,
          priceLimitMax: maxPrice,
          searchTerm: query !== '*' ? query : undefined,
          statusFilter,
        },
        sortBy as any,
        safeLimit
      );
    } catch (fallbackErr) {
      console.error('Firestore fallback for searchDealsTypesense failed:', fallbackErr);
      return [];
    }
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
      per_page: safeLimit,
    }, {});
    const hits = (res.hits || []).map((h: any) => ({ id: h.document.id, ...h.document })) as Deal[];

    // Typesense can contain stale fallback image placeholders; hydrate from Firestore on server.
    if (typeof window === 'undefined') {
      return await hydrateFallbackDealImages(hits);
    }

    return hits;
  } catch (err) {
    console.warn('Typesense deals search failed. Falling back to Firestore:', err);
    try {
      const { getDealsByFiltersData } = await import('@/lib/data/deals');
      return await getDealsByFiltersData(
        {
          categoryId: mainCategorySlug,
          subCategorySlug,
          subSubCategorySlug,
          priceLimitMin: minPrice,
          priceLimitMax: maxPrice,
          searchTerm: query !== '*' ? query : undefined,
          statusFilter,
        },
        sortBy as any,
        safeLimit
      );
    } catch (fallbackErr) {
      console.error('Firestore fallback for searchDealsTypesense failed:', fallbackErr);
      return [];
    }
  }
}

export type Suggestion = {
  type: 'product' | 'deal';
  id: string;
  label: string;
  subLabel?: string;
};

function stripHtmlTags(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';

  return value
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSuggestion(document: any, type: 'product' | 'deal'): Suggestion | null {
  const id = typeof document?.id === 'string' ? document.id : '';
  if (!id) return null;

  const rawLabel = type === 'deal'
    ? document?.title ?? document?.name ?? document?.description
    : document?.name ?? document?.title ?? document?.description;
  const rawSubLabel = type === 'deal'
    ? document?.description ?? document?.title
    : document?.description ?? document?.name;

  const label = stripHtmlTags(rawLabel);
  const subLabel = stripHtmlTags(rawSubLabel);

  if (!label) return null;

  return {
    type,
    id,
    label,
    subLabel: subLabel && subLabel !== label ? subLabel : undefined,
  };
}

export async function getAutocompleteSuggestions(q: string, limit = 5): Promise<Suggestion[]> {
  const safeLimit = clampTypesensePageSize(limit, 5);

  // If running in browser, always use server-side autocomplete endpoint
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('limit', String(safeLimit));
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
    const searches = [
      { collection: 'products', q, query_by: 'name,description', per_page: safeLimit, highlight_full_fields: 'name', prefix: true },
      { collection: 'deals', q, query_by: 'title,description', per_page: safeLimit, highlight_full_fields: 'title', prefix: true },
    ];
    const searchRequest = {
      searches: [
        ...searches,
      ],
    } as any;
    const res = await (typesenseClient as any).multiSearch.perform(searchRequest, {});
    const out: Suggestion[] = [];
    for (const [index, r] of (res.results || []).entries()) {
      const collectionName = searches[index]?.collection;
      const type: 'product' | 'deal' = collectionName === 'deals' ? 'deal' : 'product';
      for (const h of r.hits || []) {
        const suggestion = normalizeSuggestion(h.document, type);
        if (suggestion) {
          out.push(suggestion);
        }
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

  const hasAnyOutboundCandidate = (raw: any): boolean => {
    const candidates = [
      raw?.link,
      raw?.affiliateLink,
      raw?.affiliateUrl,
      raw?.dealUrl,
      raw?.sourceUrl,
      raw?.url,
      raw?.externalUrl,
      raw?.metadata?.offerPreviewUrl,
      raw?.metadata?.previewUrl,
      raw?.metadata?.offerUrl,
      raw?.metadata?.externalUrl,
      raw?.metadata?.url,
    ];

    return candidates.some((value) => typeof value === 'string' && value.trim().length > 0);
  };

  const shouldHydrateFromFirestore = (raw: any): boolean => {
    if (!raw || typeof raw !== 'object') return true;
    const keyCount = Object.keys(raw).length;
    const hasTitle = Boolean(raw?.title);
    const hasImage = Boolean(raw?.image || raw?.imageUrl || raw?.mainImage);
    const hasLink = hasAnyOutboundCandidate(raw);

    // Sparse Typesense documents (e.g. only id) break CTA links on detail page.
    return keyCount <= 3 || !hasTitle || !hasImage || !hasLink;
  };

  const readDealFromFirestore = async (): Promise<any | null> => {
    try {
      const snap = await getDoc(doc(db, 'deals', dealId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() };
    } catch (error) {
      console.warn('Firestore fallback for getDealByIdTypesense failed:', error);
      return null;
    }
  };

  const mergeDealWithFirestoreFallback = async (typesenseDeal: any): Promise<Deal> => {
    if (!shouldHydrateFromFirestore(typesenseDeal)) {
      return typesenseDeal as Deal;
    }

    const firestoreDeal = await readDealFromFirestore();
    if (!firestoreDeal) {
      return typesenseDeal as Deal;
    }

    const merged = {
      ...firestoreDeal,
      ...typesenseDeal,
    } as any;

    // Preserve critical outbound link fields when Typesense payload is sparse.
    merged.link = (
      typesenseDeal?.link
      || typesenseDeal?.affiliateLink
      || typesenseDeal?.sourceUrl
      || firestoreDeal?.link
      || firestoreDeal?.affiliateLink
      || firestoreDeal?.sourceUrl
      || ''
    ).trim();
    merged.affiliateLink = (typesenseDeal?.affiliateLink || firestoreDeal?.affiliateLink || '').trim();
    merged.affiliateUrl = (typesenseDeal?.affiliateUrl || firestoreDeal?.affiliateUrl || '').trim();
    merged.dealUrl = (typesenseDeal?.dealUrl || firestoreDeal?.dealUrl || '').trim();
    merged.sourceUrl = (typesenseDeal?.sourceUrl || firestoreDeal?.sourceUrl || '').trim();
    merged.url = (typesenseDeal?.url || firestoreDeal?.url || '').trim();
    merged.externalUrl = (typesenseDeal?.externalUrl || firestoreDeal?.externalUrl || '').trim();

    return merged as Deal;
  };

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
    console.warn('Typesense client unavailable for getDealByIdTypesense. Falling back to Firestore.');
    const firestoreDeal = await readDealFromFirestore();
    return firestoreDeal ? (firestoreDeal as Deal) : null;
  }

  try {
    const res = await typesenseClient.collections('deals').documents().search({
      q: '*',
      query_by: 'title,description,postedBy',
      filter_by: `id:=${dealId} && status:=[approved,pending,poczekalnia]`,
      per_page: 1,
    }, {});
    const firstHit = (res.hits || [])[0] as any;
    if (!firstHit?.document) {
      const firestoreDeal = await readDealFromFirestore();
      return firestoreDeal ? (firestoreDeal as Deal) : null;
    }

    const typesenseDeal = { id: firstHit.document.id, ...firstHit.document } as Deal;
    return await mergeDealWithFirestoreFallback(typesenseDeal);
  } catch (e) {
    console.warn('Typesense getDealById failed:', e);
    const firestoreDeal = await readDealFromFirestore();
    return firestoreDeal ? (firestoreDeal as Deal) : null;
  }
}
