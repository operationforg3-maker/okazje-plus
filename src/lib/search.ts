import typesenseClient from '@/lib/typesense';
import { Product, Deal } from '@/lib/types';
import { searchProducts as fallbackSearch } from '@/lib/data';

export type ProductSearchOptions = {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  limit?: number;
};

// Pełnotekstowe wyszukiwanie produktów w Typesense z filtrowaniem po kategoriach
export async function searchProductsTypesense(
  q: string,
  opts: ProductSearchOptions = {}
): Promise<Product[]> {
  const { mainCategorySlug, subCategorySlug, limit = 50 } = opts;

  // Fallback: jeśli Typesense nie skonfigurowany, użyj dotychczasowego wyszukiwania Firestore
  if (!typesenseClient) {
    return fallbackSearch(q);
  }

  const filters: string[] = [];
  if (mainCategorySlug) filters.push(`mainCategorySlug:=${mainCategorySlug}`);
  if (subCategorySlug) filters.push(`subCategorySlug:=${subCategorySlug}`);
  filters.push(`status:=approved`);

  try {
    const res = await typesenseClient
      .collections('products')
      .documents()
      .search({
        q,
        query_by: 'name,description',
        filter_by: filters.join(' && '),
        per_page: limit,
      }, {});

    // Zakładamy, że dokumenty w indeksie zawierają pełne pola Product
    const hits = (res.hits || []).map((h: any) => ({ id: h.document.id, ...h.document })) as Product[];
    return hits;
  } catch (err) {
    console.warn('Typesense search failed, falling back to Firestore search:', err);
    return fallbackSearch(q);
  }
}

export type DealSearchOptions = {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  limit?: number;
};

export async function searchDealsTypesense(
  q: string,
  opts: DealSearchOptions = {}
): Promise<Deal[]> {
  const { mainCategorySlug, subCategorySlug, limit = 50 } = opts;
  if (!typesenseClient) return []; // brak fallbacku, bo nie mamy firestore search dla deals
  const filters: string[] = [];
  if (mainCategorySlug) filters.push(`mainCategorySlug:=${mainCategorySlug}`);
  if (subCategorySlug) filters.push(`subCategorySlug:=${subCategorySlug}`);
  filters.push(`status:=approved`);
  try {
    const res = await typesenseClient.collections('deals').documents().search({
      q,
      query_by: 'title,description,postedBy',
      filter_by: filters.join(' && '),
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
  // Fallback: jeśli Typesense nie skonfigurowany, użyj Firestore
  if (!typesenseClient) {
    return getFirestoreAutocompleteSuggestions(q, limit);
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
    console.warn('Typesense autocomplete failed, falling back to Firestore:', e);
    return getFirestoreAutocompleteSuggestions(q, limit);
  }
}

// Firestore fallback dla autocomplete (bez Typesense)
async function getFirestoreAutocompleteSuggestions(q: string, limit = 5): Promise<Suggestion[]> {
  const { searchProducts, getHotDeals } = await import('@/lib/data');
  const normalizedQuery = q.toLowerCase().trim();
  
  try {
    // Szukaj produktów i deals równolegle
    const [products, deals] = await Promise.all([
      searchProducts(q).then(p => p.slice(0, limit)),
      getHotDeals(limit)
    ]);

    const out: Suggestion[] = [];

    // Filtruj produkty po nazwie lub opisie
    products
      .filter(p => 
        p.name.toLowerCase().includes(normalizedQuery) || 
        p.description?.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, limit)
      .forEach(p => {
        out.push({
          type: 'product',
          id: p.id,
          label: p.name,
          subLabel: p.description,
        });
      });

    // Filtruj deals po tytule lub opisie
    deals
      .filter(d => 
        d.title.toLowerCase().includes(normalizedQuery) || 
        d.description?.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, Math.max(0, limit - out.length))
      .forEach(d => {
        out.push({
          type: 'deal',
          id: d.id,
          label: d.title,
          subLabel: d.description,
        });
      });

    return out;
  } catch (err) {
    console.error('Firestore autocomplete failed:', err);
    return [];
  }
}
