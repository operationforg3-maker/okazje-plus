import typesenseClient from '@/lib/typesense';
import { Product } from '@/lib/types';
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
