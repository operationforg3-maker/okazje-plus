import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProductCore } from '@/lib/types';
import { sanitizeProductCoreRecord } from '@/lib/sanitizers';

const docToProductCore = (snap: any): ProductCore => sanitizeProductCoreRecord(snap.data(), snap.id);

export async function getRecommendedProductCoresData(count: number = 50): Promise<ProductCore[]> {
  try {
    const ref = collection(db, 'product_cores');
    const productsMap = new Map<string, ProductCore>();
    const baseLimit = count * 2;

    try {
      const approvedQ = query(ref, where('status', '==', 'approved'), limit(baseLimit));
      const approvedSnap = await getDocs(approvedQ);

      for (const doc of approvedSnap.docs) {
        if (!productsMap.has(doc.id)) {
          productsMap.set(doc.id, docToProductCore(doc));
        }
      }
    } catch (err) {
      console.error('Error fetching approved recommended products:', err);
    }

    if (typeof window === 'undefined' && productsMap.size < count) {
      try {
        const { getAdminFirestore } = await import('@/lib/firebase-admin-server');
        const adminDb = getAdminFirestore();
        const statusPriority = ['pending_approval', 'approval'];

        for (const status of statusPriority) {
          if (productsMap.size >= baseLimit) break;

          const snap = await adminDb
            .collection('product_cores')
            .where('status', '==', status)
            .limit(baseLimit)
            .get();

          for (const doc of snap.docs) {
            if (!productsMap.has(doc.id)) {
              productsMap.set(doc.id, sanitizeProductCoreRecord(doc.data(), doc.id));
            }
          }
        }
      } catch (err) {
        console.warn('Admin fallback for recommended products unavailable:', err);
      }
    }

    const products = Array.from(productsMap.values());

    products.sort((a, b) => {
      const priceA = a.bestPrice?.amount || 0;
      const priceB = b.bestPrice?.amount || 0;
      return priceA - priceB;
    });

    return products.slice(0, count);
  } catch (err) {
    console.error('Error fetching recommended products:', err);
    return [];
  }
}

export async function getProductCoresByCategoryData(
  mainCategorySlug: string,
  subCategorySlug?: string,
  subSubCategorySlug?: string,
  limitCount: number = 50
): Promise<ProductCore[]> {
  try {
    const ref = collection(db, 'product_cores');
    const constraints: any[] = [where('status', '==', 'approved'), where('mainCategorySlug', '==', mainCategorySlug)];

    if (subCategorySlug) {
      constraints.push(where('subCategorySlug', '==', subCategorySlug));
    }

    if (subSubCategorySlug) {
      constraints.push(where('subSubCategorySlug', '==', subSubCategorySlug));
    }

    constraints.push(limit(limitCount * 2));

    const q = query(ref, ...constraints);
    const snap = await getDocs(q);
    const products = snap.docs.map(docToProductCore);

    products.sort((a, b) => {
      const priceA = a.bestPrice?.amount || 0;
      const priceB = b.bestPrice?.amount || 0;
      return priceA - priceB;
    });

    return products.slice(0, limitCount);
  } catch (err) {
    console.error('Error fetching products by category:', err);
    return [];
  }
}

export async function getProductCoresByFiltersData(
  filters: {
    priceRange?: { min: number; max: number };
    priceLimitMin?: number;
    priceLimitMax?: number;
    minRating?: number;
    inStockOnly?: boolean;
    discountOnly?: boolean;
    categoryId?: string;
    subCategorySlug?: string;
    subSubCategorySlug?: string;
    brands?: string[];
    searchTerm?: string;
    statusFilter?: 'approved' | 'waiting_room';
  },
  sortBy: 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'hot' | 'relevance' | 'popularity' = 'relevance',
  limitCount: number = 50
): Promise<ProductCore[]> {
  try {
    const statuses = filters.statusFilter === 'waiting_room'
      ? ['pending_approval', 'approval', 'pending', 'poczekalnia']
      : ['approved'];

    const snapshots = await Promise.all(
      statuses.map(async (status) => {
        const constraints: any[] = [where('status', '==', status)];

        if (filters.categoryId) {
          constraints.push(where('mainCategorySlug', '==', filters.categoryId));
        }

        if (filters.subCategorySlug) {
          constraints.push(where('subCategorySlug', '==', filters.subCategorySlug));
        }

        if (filters.subSubCategorySlug) {
          constraints.push(where('subSubCategorySlug', '==', filters.subSubCategorySlug));
        }

        const baseQuery = query(collection(db, 'product_cores'), ...constraints, limit(limitCount));

        try {
          return await getDocs(baseQuery);
        } catch (error: any) {
          const message = String(error?.message || '');
          const isIndexIssue = message.includes('index') || message.includes('FAILED_PRECONDITION');

          if (!isIndexIssue) throw error;

          // Fallback without composite category filters; category checks are enforced in-memory below.
          const fallbackQuery = query(
            collection(db, 'product_cores'),
            where('status', '==', status),
            limit(limitCount * 3)
          );

          return getDocs(fallbackQuery);
        }
      })
    );

    const productsMap = new Map<string, ProductCore>();
    for (const snapshot of snapshots) {
      for (const docSnap of snapshot.docs) {
        if (!productsMap.has(docSnap.id)) {
          productsMap.set(docSnap.id, docToProductCore(docSnap));
        }
      }
    }

    const products: ProductCore[] = Array.from(productsMap.values());

    const filtered = products.filter(product => {
      if (filters.categoryId && product.mainCategorySlug !== filters.categoryId) return false;
      if (filters.subCategorySlug && product.subCategorySlug !== filters.subCategorySlug) return false;
      if (filters.subSubCategorySlug && product.subSubCategorySlug !== filters.subSubCategorySlug) return false;

      if (filters.priceRange) {
        const price = product.bestPrice?.amount || 0;
        if (price < filters.priceRange.min || price > filters.priceRange.max) return false;
      }

      if (filters.minRating && (product.rating?.score || 0) < filters.minRating) return false;

      if (filters.brands && filters.brands.length > 0) {
        const productBrand = product.metadata?.brand || '';
        if (!filters.brands.includes(productBrand)) return false;
      }

      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const titleText = (typeof product.title === 'object' ? product.title.pl : product.title || '').toLowerCase();
        const descText = (typeof product.description === 'object' ? product.description.pl : product.description || '').toLowerCase();
        if (!titleText.includes(searchLower) && !descText.includes(searchLower)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return (a.bestPrice?.amount || 0) - (b.bestPrice?.amount || 0);
        case 'price_desc':
          return (b.bestPrice?.amount || 0) - (a.bestPrice?.amount || 0);
        case 'rating_desc':
          return (b.rating?.score || 0) - (a.rating?.score || 0);
        case 'newest':
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        case 'popularity':
          return ((b as any).marketing?.ordersCount || 0) - ((a as any).marketing?.ordersCount || 0);
        case 'hot':
          return (b.rating?.count || 0) - (a.rating?.count || 0);
        case 'relevance':
        default:
          return 0;
      }
    });

    return filtered.slice(0, limitCount);
  } catch (err) {
    console.error('Error filtering products:', err);
    return [];
  }
}
