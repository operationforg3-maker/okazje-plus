import { Deal, ProductCore } from '@/lib/types';

export type Suggestion = {
  type: 'product' | 'deal';
  id: string;
  label: string;
  subLabel?: string;
};
import { collection, doc, documentId, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const DEAL_IMAGE_FALLBACK = '/icon_okazjeplus.svg';
const MAX_PAGE_SIZE = 3000;

const clampPageSize = (value?: number, fallback = 50): number => {
  const raw = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, raw));
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
  page?: number;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'newest';
  statusFilter?: 'approved' | 'waiting_room';
};

export async function searchProductsTypesense(
  q: string,
  opts: ProductSearchOptions = {}
): Promise<ProductCore[]> {
  const { limit = 50 } = opts;
  const safeLimit = clampPageSize(limit, 50);
  return searchProductsFirestoreFallback(q, opts, safeLimit);
}

export type DealSearchOptions = {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  minTemperature?: number;
  limit?: number;
  page?: number;
  sortBy?: 'relevance' | 'temperature' | 'hot' | 'price_asc' | 'price_desc' | 'newest' | 'discount_desc' | 'popularity';
  statusFilter?: 'approved' | 'waiting_room';
};

export async function searchDealsTypesense(
  q: string,
  opts: DealSearchOptions = {}
): Promise<Deal[]> {
  const { limit = 50 } = opts;
  const safeLimit = clampPageSize(limit, 50);
  return searchDealsFirestoreFallback(q, opts, safeLimit);
}

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

function resolveLocalizedString(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidate = obj.pl || obj.en || obj.de || obj.fr || obj.es || obj.uk;
    if (typeof candidate === 'string') return candidate;
    
    // Fallback to any string property
    for (const val of Object.values(obj)) {
      if (typeof val === 'string') return val;
    }
  }
  return '';
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

  const resolvedLabel = resolveLocalizedString(rawLabel);
  const resolvedSubLabel = resolveLocalizedString(rawSubLabel);

  const label = stripHtmlTags(resolvedLabel);
  const subLabel = stripHtmlTags(resolvedSubLabel);

  if (!label) return null;

  return {
    type,
    id,
    label,
    subLabel: subLabel && subLabel !== label ? subLabel : undefined,
  };
}

export async function getAutocompleteSuggestions(q: string, limit = 5): Promise<Suggestion[]> {
  const safeLimit = clampPageSize(limit, 5);

  try {
    const { adminDb } = await import('@/lib/firebase-admin');

    const qLower = q.toLowerCase();
    
    // Fetch a batch of approved products and deals
    const [productsSnap, dealsSnap] = await Promise.all([
      adminDb.collection('product_cores')
        .where('status', '==', 'approved')
        .limit(40).get(),
      adminDb.collection('deals')
        .where('status', '==', 'approved')
        .limit(40).get()
    ]);

    const out: Suggestion[] = [];

    // Filter products locally by search query
    productsSnap.docs.forEach((docSnap: any) => {
      const doc = docSnap.data();
      const titleStr = typeof doc.title === 'object' ? String(doc.title?.pl || doc.title?.en || '') : String(doc.title || '');
      if (titleStr.toLowerCase().includes(qLower)) {
        const suggestion = normalizeSuggestion({ id: docSnap.id, ...doc }, 'product');
        if (suggestion) out.push(suggestion);
      }
    });

    // Filter deals locally by search query
    dealsSnap.docs.forEach((docSnap: any) => {
      const doc = docSnap.data();
      const titleStr = typeof doc.title === 'object' ? String(doc.title?.pl || doc.title?.en || '') : String(doc.title || '');
      if (titleStr.toLowerCase().includes(qLower)) {
        const suggestion = normalizeSuggestion({ id: docSnap.id, ...doc }, 'deal');
        if (suggestion) out.push(suggestion);
      }
    });

    return out.slice(0, safeLimit);
  } catch (err) {
    console.warn('Firestore autocomplete failed:', err);
    return [];
  }
}

export async function getDealByIdTypesense(dealId: string): Promise<Deal | null> {
  if (!dealId) return null;

  try {
    // Admin SDK — działa server-side bez auth (client SDK rzucał błąd SSR → null → 404)
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('deals').doc(dealId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as Deal;
  } catch (error) {
    console.warn('getDealByIdTypesense failed:', error);
    return null;
  }
}

async function searchProductsFirestoreFallback(
  q: string,
  opts: ProductSearchOptions,
  safeLimit: number
): Promise<ProductCore[]> {
  const {
    mainCategorySlug,
    subCategorySlug,
    subSubCategorySlug,
    minPrice,
    maxPrice,
    minRating,
    sortBy = 'relevance',
    statusFilter = 'approved',
    page = 1,
  } = opts;

  const query = q.trim().length > 0 ? q : '*';

  try {
    if (query !== '*') {
      const { adminDb, FieldValue } = await import('@/lib/firebase-admin');
      const targetStatus = statusFilter === 'waiting_room' ? 'pending' : 'approved';
      
      let docs: any[] = [];
      let vectorSearchSuccess = false;

      try {
        const { generateEmbeddings } = await import('@/ai/embeddings');
        const queryVector = await generateEmbeddings(q);

        const queryBase = adminDb.collection('product_cores')
          .where('status', '==', targetStatus);

        let snap;
        try {
          snap = await queryBase.findNearest({
            vectorField: 'embedding',
            queryVector: FieldValue.vector(queryVector),
            distanceMeasure: 'COSINE',
            limit: Math.max(safeLimit * page * 3, 100),
          }).get();
        } catch (err: any) {
          const errStr = String(err);
          if (errStr.includes('FAILED_PRECONDITION') || errStr.includes('index') || errStr.includes('Index')) {
            console.warn('[Search Fallback] Composite vector index missing or building. Falling back to status-less query...');
            snap = await adminDb.collection('product_cores').findNearest({
              vectorField: 'embedding',
              queryVector: FieldValue.vector(queryVector),
              distanceMeasure: 'COSINE',
              limit: Math.max(safeLimit * page * 3, 100),
            }).get();
          } else {
            throw err;
          }
        }

        docs = snap.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));
        docs = docs.filter((d: any) => d.status === targetStatus);
        vectorSearchSuccess = true;
      } catch (err) {
        console.warn('[Search Fallback] Vector search failed or suspended. Falling back to keyword search...', err);
      }

      // Keyword search fallback
      if (!vectorSearchSuccess) {
        const keywords = q.toLowerCase().split(/\s+/).filter(w => w.trim().length > 1);
        if (keywords.length > 0) {
          const getWordVariations = (word: string) => {
            const w = word.trim();
            if (!w) return [];
            const lower = w.toLowerCase();
            const upper = w.toUpperCase();
            const capitalized = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            return [...new Set([w, lower, upper, capitalized])];
          };

          let snap;
          try {
            snap = await adminDb.collection('product_cores')
              .where('status', '==', targetStatus)
              .where('searchTags', 'array-contains-any', getWordVariations(keywords[0]))
              .limit(100)
              .get();
          } catch (queryErr) {
            console.warn('[Search Fallback] tags array-contains-any query failed. Fetching recent products...', queryErr);
            snap = await adminDb.collection('product_cores')
              .where('status', '==', targetStatus)
              .limit(100)
              .get();
          }

          docs = snap.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));

          // Post-filter matching all keywords in title, description, or tags
          docs = docs.filter((d: any) => {
            const titleStr = typeof d.title === 'object' ? String(d.title?.pl || d.title?.en || '').toLowerCase() : String(d.title || '').toLowerCase();
            const descStr = typeof d.description === 'object' ? String(d.description?.pl || d.description?.en || '').toLowerCase() : String(d.description || '').toLowerCase();
            const tags = Array.isArray(d.searchTags) ? d.searchTags.map((t: string) => t.toLowerCase()) : [];
            
            return keywords.every(kw => 
              titleStr.includes(kw) || descStr.includes(kw) || tags.includes(kw)
            );
          });
        }
      }

      // Post-filtering
      if (mainCategorySlug) docs = docs.filter((d: any) => d.mainCategorySlug === mainCategorySlug);
      if (subCategorySlug) docs = docs.filter((d: any) => d.subCategorySlug === subCategorySlug);
      if (subSubCategorySlug) docs = docs.filter((d: any) => d.subSubCategorySlug === subSubCategorySlug);
      if (minPrice !== undefined) docs = docs.filter((d: any) => (d.bestPrice?.amount || d.price || 0) >= Number(minPrice));
      if (maxPrice !== undefined) docs = docs.filter((d: any) => (d.bestPrice?.amount || d.price || 0) <= Number(maxPrice));
      if (minRating !== undefined) docs = docs.filter((d: any) => (d.ratingCard?.average || d.rating || 0) >= Number(minRating));

      const offset = (page - 1) * safeLimit;
      return docs.slice(offset, offset + safeLimit) as ProductCore[];
    } else {
      const { getProductCoresByFiltersData } = await import('@/lib/data/products');
      const fetchLimit = safeLimit * page;
      const allDocs = await getProductCoresByFiltersData(
        {
          categoryId: mainCategorySlug,
          subCategorySlug,
          subSubCategorySlug,
          priceLimitMin: minPrice,
          priceLimitMax: maxPrice,
          minRating,
          searchTerm: undefined,
          statusFilter,
        },
        sortBy as any,
        fetchLimit
      );
      const offset = (page - 1) * safeLimit;
      return allDocs.slice(offset, offset + safeLimit);
    }
  } catch (err) {
    console.error('Firestore fallback for searchProductsTypesense failed:', err);
    return [];
  }
}

async function searchDealsFirestoreFallback(
  q: string,
  opts: DealSearchOptions,
  safeLimit: number
): Promise<Deal[]> {
  const {
    mainCategorySlug,
    subCategorySlug,
    subSubCategorySlug,
    minPrice,
    maxPrice,
    minTemperature,
    sortBy = 'relevance',
    statusFilter = 'approved',
    page = 1,
  } = opts;

  const query = q.trim().length > 0 ? q : '*';

  try {
    if (query !== '*') {
      const { adminDb, FieldValue } = await import('@/lib/firebase-admin');
      const statuses = statusFilter === 'waiting_room'
        ? ['pending', 'poczekalnia', 'pending_approval', 'approval']
        : ['approved'];

      let docs: any[] = [];
      let vectorSearchSuccess = false;

      try {
        const { generateEmbeddings } = await import('@/ai/embeddings');
        const queryVector = await generateEmbeddings(query);

        const resultsArray = await Promise.all(
          statuses.map(async (status) => {
            const queryBase = adminDb.collection('deals').where('status', '==', status);
            let snap;
            try {
              snap = await queryBase.findNearest({
                vectorField: 'embedding',
                queryVector: FieldValue.vector(queryVector),
                distanceMeasure: 'COSINE',
                limit: safeLimit * 3,
              }).get();
            } catch (err: any) {
              const errStr = String(err);
              if (errStr.includes('FAILED_PRECONDITION') || errStr.includes('index') || errStr.includes('Index')) {
                console.warn('[Search Fallback] Deals composite vector index missing or building. Falling back to status-less query...');
                snap = await adminDb.collection('deals').findNearest({
                  vectorField: 'embedding',
                  queryVector: FieldValue.vector(queryVector),
                  distanceMeasure: 'COSINE',
                  limit: safeLimit * 3,
                }).get();
              } else {
                throw err;
              }
            }
            let docsVal = snap.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));
            return docsVal.filter((d: any) => d.status === status);
          })
        );

        docs = resultsArray.flat();
        vectorSearchSuccess = true;
      } catch (err) {
        console.warn('[Search Fallback] Deals vector search failed or suspended. Falling back to keyword search...', err);
      }

      // Keyword search fallback for deals
      if (!vectorSearchSuccess) {
        const keywords = query.toLowerCase().split(/\s+/).filter(w => w.trim().length > 1);
        if (keywords.length > 0) {
          // 1. Direct title/desc match on recent 300 deals
          const resultsArray = await Promise.all(
            statuses.map(async (status) => {
              const snap = await adminDb.collection('deals')
                .where('status', '==', status)
                .orderBy('createdAt', 'desc')
                .limit(300)
                .get();
              return snap.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));
            })
          );
          let recentDeals = resultsArray.flat();
          
          // Filter direct matches
          let directMatchDeals = recentDeals.filter((d: any) => {
            const titleStr = typeof d.title === 'object' ? String(d.title?.pl || d.title?.en || '').toLowerCase() : String(d.title || '').toLowerCase();
            const descStr = typeof d.description === 'object' ? String(d.description?.pl || d.description?.en || '').toLowerCase() : String(d.description || '').toLowerCase();
            return keywords.every(kw => titleStr.includes(kw) || descStr.includes(kw));
          });

          // 2. Relational match via product search
          let productMatchDeals: any[] = [];
          const getWordVariations = (word: string) => {
            const w = word.trim();
            if (!w) return [];
            const lower = w.toLowerCase();
            const upper = w.toUpperCase();
            const capitalized = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            return [...new Set([w, lower, upper, capitalized])];
          };

          const targetStatus = statusFilter === 'waiting_room' ? 'pending' : 'approved';
          let prodSnap;
          try {
            prodSnap = await adminDb.collection('product_cores')
              .where('status', '==', targetStatus)
              .where('searchTags', 'array-contains-any', getWordVariations(keywords[0]))
              .limit(20)
              .get();
          } catch {
            prodSnap = { docs: [] };
          }

          const matchedProductIds = prodSnap.docs.map((docSnap: any) => docSnap.id);
          if (matchedProductIds.length > 0) {
            const chunkedProductIds = chunkIds(matchedProductIds, 10);
            const relationalDealsList = await Promise.all(
              chunkedProductIds.map(async (chunk) => {
                const snap = await adminDb.collection('deals')
                  .where('status', 'in', statuses)
                  .where('productId', 'in', chunk)
                  .limit(50)
                  .get();
                return snap.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));
              })
            );
            productMatchDeals = relationalDealsList.flat();
          }

          // Combine & deduplicate
          const combinedMap = new Map<string, any>();
          for (const d of [...directMatchDeals, ...productMatchDeals]) {
            combinedMap.set(d.id, d);
          }
          docs = Array.from(combinedMap.values());
        }
      }

      // Post-filtering
      if (mainCategorySlug) docs = docs.filter((d: any) => d.mainCategorySlug === mainCategorySlug);
      if (subCategorySlug) docs = docs.filter((d: any) => d.subCategorySlug === subCategorySlug);
      if (subSubCategorySlug) docs = docs.filter((d: any) => d.subSubCategorySlug === subSubCategorySlug);
      if (minPrice !== undefined) docs = docs.filter((d: any) => {
        const priceVal = typeof d.price === 'object' && d.price ? (d.price as any).amount : (typeof d.price === 'number' ? d.price : 0);
        return ((d as any).priceV2?.amount || priceVal) >= Number(minPrice);
      });
      if (maxPrice !== undefined) docs = docs.filter((d: any) => {
        const priceVal = typeof d.price === 'object' && d.price ? (d.price as any).amount : (typeof d.price === 'number' ? d.price : 0);
        return ((d as any).priceV2?.amount || priceVal) <= Number(maxPrice);
      });
      if (minTemperature !== undefined) docs = docs.filter((d: any) => (d.temperature || 0) >= Number(minTemperature));

      // Sorting
      docs.sort((a: any, b: any) => {
        if (sortBy === 'temperature' || sortBy === 'hot' || sortBy === 'popularity') return (b.temperature || 0) - (a.temperature || 0);
        if (sortBy === 'price_asc') {
          const aPrice = (a as any).priceV2?.amount || (typeof a.price === 'object' && a.price ? (a.price as any).amount : (typeof a.price === 'number' ? a.price : 0));
          const bPrice = (b as any).priceV2?.amount || (typeof b.price === 'object' && b.price ? (b.price as any).amount : (typeof b.price === 'number' ? b.price : 0));
          return aPrice - bPrice;
        }
        if (sortBy === 'price_desc') {
          const aPrice = (a as any).priceV2?.amount || (typeof a.price === 'object' && a.price ? (a.price as any).amount : (typeof a.price === 'number' ? a.price : 0));
          const bPrice = (b as any).priceV2?.amount || (typeof b.price === 'object' && b.price ? (b.price as any).amount : (typeof b.price === 'number' ? b.price : 0));
          return bPrice - aPrice;
        }
        if (sortBy === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        return 0; // relevance
      });

      const offset = (page - 1) * safeLimit;
      return await hydrateFallbackDealImages(docs.slice(offset, offset + safeLimit) as Deal[]);
    } else {
      const { getDealsByFiltersData } = await import('@/lib/data/deals');
      const fetchLimit = safeLimit * page;
      const allDocs = await getDealsByFiltersData(
        {
          categoryId: mainCategorySlug,
          subCategorySlug,
          subSubCategorySlug,
          priceLimitMin: minPrice,
          priceLimitMax: maxPrice,
          searchTerm: undefined,
          statusFilter,
        },
        sortBy as any,
        fetchLimit
      );
      const offset = (page - 1) * safeLimit;
      return allDocs.slice(offset, offset + safeLimit);
    }
  } catch (err) {
    console.error('Firestore fallback for searchDealsTypesense failed:', err);
    return [];
  }
}
