import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal } from '@/lib/types';
import { sanitizeDealRecord } from '@/lib/sanitizers';

const docToDeal = (snap: any): Deal => sanitizeDealRecord(snap.data(), snap.id);

const TEMPERATURE_HALF_LIFE_HOURS = 48;

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function withDecayedTemperature(deal: Deal): Deal {
  const baseTemperature = Number(deal.temperature || 0);
  if (!Number.isFinite(baseTemperature) || baseTemperature <= 0) return deal;

  const referenceTs = (deal as any).lastVoteAt || (deal as any).updatedAt || deal.postedAt;
  const referenceMillis = toMillis(referenceTs);
  if (!referenceMillis) return deal;

  const ageHours = Math.max(0, (Date.now() - referenceMillis) / (1000 * 60 * 60));
  const decayFactor = Math.exp((-Math.log(2) * ageHours) / TEMPERATURE_HALF_LIFE_HOURS);
  const decayedTemperature = Math.round(baseTemperature * decayFactor * 100) / 100;

  return {
    ...deal,
    temperature: decayedTemperature,
  };
}

function rankDealsWithDecay(deals: Deal[], count: number): Deal[] {
  return deals
    .map(withDecayedTemperature)
    .sort((a, b) => (b.temperature || 0) - (a.temperature || 0))
    .slice(0, count);
}

const warnedOnce = new Set<string>();
function warnOnce(key: string, ...args: any[]) {
  if (!warnedOnce.has(key)) {
    console.warn(...args);
    warnedOnce.add(key);
  }
}

export async function getHotDealsData(count: number): Promise<Deal[]> {
  // Lazy import cache tylko na serwerze; dla klienta funkcja i tak zwykle nie będzie używana.
  let cacheGetFn: any = null;
  let cacheSetFn: any = null;
  if (typeof window === 'undefined') {
    try {
      const mod = await import('@/lib/cache');
      cacheGetFn = mod.cacheGet;
      cacheSetFn = mod.cacheSet;
    } catch (_) {}
  }

  const cacheKey = `deals:hot:${count}`;
  if (cacheGetFn) {
    const cached = await cacheGetFn(cacheKey);
    if (cached) return cached as Deal[];
  }

  try {
    const dealsRef = collection(db, 'deals');
    const fetchLimit = Math.min(Math.max(count * 5, 100), 400);
    const q = query(dealsRef, where('status', '==', 'approved'), orderBy('temperature', 'desc'), limit(fetchLimit));
    const querySnapshot = await getDocs(q);
    const deals = rankDealsWithDecay(querySnapshot.docs.map(docToDeal), count);

    if (cacheSetFn) {
      await cacheSetFn(cacheKey, deals, 300);
    }

    return deals;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('index') && errorMessage.includes('building')) {
      console.warn('[getHotDeals] Index building, returning empty array temporarily');
      return [];
    }
    throw error;
  }
}

export async function getHotDealsByCategoryData(mainCategorySlug: string, count: number = 3): Promise<Deal[]> {
  const dealsRef = collection(db, 'deals');
  const fetchLimit = Math.min(Math.max(count * 5, 60), 300);
  try {
    const q1 = query(
      dealsRef,
      where('status', '==', 'approved'),
      where('mainCategorySlug', '==', mainCategorySlug),
      orderBy('temperature', 'desc'),
      limit(fetchLimit)
    );
    const snap = await getDocs(q1);
    return rankDealsWithDecay(snap.docs.map(docToDeal), count);
  } catch (_) {
    const q2 = query(dealsRef, where('status', '==', 'approved'), where('mainCategorySlug', '==', mainCategorySlug), limit(fetchLimit));
    const snap2 = await getDocs(q2);
    return rankDealsWithDecay(snap2.docs.map(docToDeal), count);
  }
}

export async function getDealsByCategoryData(
  mainCategorySlug: string,
  subCategorySlug?: string,
  subSubCategorySlug?: string,
  count: number = 100
): Promise<Deal[]> {
  const dealsRef = collection(db, 'deals');
  const fetchLimit = Math.min(Math.max(count * 3, 120), 400);

  const buildPrimaryQuery = () => {
    if (subSubCategorySlug && subCategorySlug) {
      return query(
        dealsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        where('subCategorySlug', '==', subCategorySlug),
        where('subSubCategorySlug', '==', subSubCategorySlug),
        orderBy('temperature', 'desc'),
        limit(fetchLimit)
      );
    }

    if (subCategorySlug) {
      return query(
        dealsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        where('subCategorySlug', '==', subCategorySlug),
        orderBy('temperature', 'desc'),
        limit(fetchLimit)
      );
    }

    return query(
      dealsRef,
      where('status', '==', 'approved'),
      where('mainCategorySlug', '==', mainCategorySlug),
      orderBy('temperature', 'desc'),
      limit(fetchLimit)
    );
  };

  const buildFallbackQuery = () => {
    if (subSubCategorySlug && subCategorySlug) {
      return query(
        dealsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        where('subCategorySlug', '==', subCategorySlug),
        where('subSubCategorySlug', '==', subSubCategorySlug),
        limit(fetchLimit)
      );
    }

    if (subCategorySlug) {
      return query(
        dealsRef,
        where('status', '==', 'approved'),
        where('mainCategorySlug', '==', mainCategorySlug),
        where('subCategorySlug', '==', subCategorySlug),
        limit(fetchLimit)
      );
    }

    return query(
      dealsRef,
      where('status', '==', 'approved'),
      where('mainCategorySlug', '==', mainCategorySlug),
      limit(fetchLimit)
    );
  };

  try {
    const primarySnap = await getDocs(buildPrimaryQuery());
    return rankDealsWithDecay(primarySnap.docs.map(docToDeal), count);
  } catch (err: any) {
    warnOnce('getDealsByCategory-primary', 'getDealsByCategory primary query failed - fallback', err?.message || err);
    try {
      const fbSnap = await getDocs(buildFallbackQuery());
      return rankDealsWithDecay(fbSnap.docs.map(docToDeal), count);
    } catch (inner: any) {
      console.error('getDealsByCategory fallback failed', inner?.message || inner);
      return [];
    }
  }
}

export async function getDealsByFiltersData(
  filters: {
    priceRange?: { min: number; max: number };
    priceLimitMin?: number;
    priceLimitMax?: number;
    minRating?: number;
    inStockOnly?: boolean;
    discountOnly?: boolean;
    minDiscount?: number;
    categoryId?: string;
    subCategorySlug?: string;
    subSubCategorySlug?: string;
    sources?: Array<'aliexpress' | 'amazon' | 'allegro'>;
    searchTerm?: string;
    statusFilter?: 'approved' | 'waiting_room';
  },
  sortBy: 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'hot' | 'discount_desc' | 'popularity' = 'hot',
  limitCount: number = 50
): Promise<Deal[]> {
  try {
    if (filters.searchTerm && filters.searchTerm.trim().length > 0) {
      const { searchDeals } = await import('@/lib/search-server');
      return searchDeals(filters.searchTerm.trim(), {
        mainCategorySlug: filters.categoryId,
        subCategorySlug: filters.subCategorySlug,
        subSubCategorySlug: filters.subSubCategorySlug,
        minPrice: filters.priceRange?.min,
        maxPrice: filters.priceRange?.max,
        limit: limitCount,
        sortBy: sortBy as any,
        statusFilter: filters.statusFilter,
      });
    }

    const statuses = filters.statusFilter === 'waiting_room'
      ? ['pending', 'poczekalnia', 'pending_approval', 'approval']
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

        const baseQuery = query(collection(db, 'deals'), ...constraints, limit(limitCount));

        try {
          return await getDocs(baseQuery);
        } catch (error: any) {
          const message = String(error?.message || '');
          const isIndexIssue = message.includes('index') || message.includes('FAILED_PRECONDITION');

          if (!isIndexIssue) throw error;

          // Fallback without composite category filters; category checks are enforced in-memory below.
          const fallbackQuery = query(
            collection(db, 'deals'),
            where('status', '==', status),
            limit(limitCount * 3)
          );

          return getDocs(fallbackQuery);
        }
      })
    );

    const dealsMap = new Map<string, Deal>();
    for (const snapshot of snapshots) {
      for (const docSnap of snapshot.docs) {
        if (!dealsMap.has(docSnap.id)) {
          dealsMap.set(docSnap.id, docToDeal(docSnap));
        }
      }
    }

    const deals: Deal[] = Array.from(dealsMap.values());

    const filtered = deals.filter(d => {
      const deal = d as Deal;

      let mainCat = deal.mainCategorySlug;
      let subCat = deal.subCategorySlug;
      let subSubCat = deal.subSubCategorySlug;

      if ((!mainCat || mainCat === 'uncategorized') && (deal as any).category) {
        const parts = ((deal as any).category as string).split('/');
        mainCat = parts[0] || 'uncategorized';
        subCat = parts[1] || 'uncategorized';
        subSubCat = parts[2] || undefined;
      }

      if (filters.categoryId && mainCat !== filters.categoryId) return false;
      if (filters.subCategorySlug && subCat !== filters.subCategorySlug) return false;
      if (filters.subSubCategorySlug && subSubCat !== filters.subSubCategorySlug) return false;

      if (filters.priceRange) {
        const priceVal = typeof deal.price === 'object' && deal.price ? (deal.price as any).amount : (typeof deal.price === 'number' ? deal.price : 0);
        const price = (deal as any).priceV2?.amount || priceVal;
        if (price < filters.priceRange.min || price > filters.priceRange.max) return false;
      }

      if (filters.inStockOnly && (deal as any).inStock === false) return false;

      if (filters.discountOnly && !deal.originalPrice) return false;
      if (filters.minDiscount && deal.originalPrice) {
        const priceVal = typeof deal.price === 'object' && deal.price ? (deal.price as any).amount : (typeof deal.price === 'number' ? deal.price : 0);
        const price = (deal as any).priceV2?.amount || priceVal;
        const discount = ((deal.originalPrice - price) / deal.originalPrice) * 100;
        if (discount < filters.minDiscount) return false;
      }

      if (filters.sources && filters.sources.length > 0) {
        if (!filters.sources.includes((deal as any).source)) return false;
      }

      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const titleText = typeof deal.title === 'object' ? (deal.title.pl || deal.title.en || '') : (deal.title || '');
        const titleMatch = titleText.toLowerCase().includes(searchLower);
        if (!titleMatch) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      const da = a as Deal;
      const db = b as Deal;
      switch (sortBy) {
        case 'price_asc': {
          const aPrice = (da as any).priceV2?.amount || (typeof da.price === 'object' && da.price ? (da.price as any).amount : (typeof da.price === 'number' ? da.price : 0));
          const bPrice = (db as any).priceV2?.amount || (typeof db.price === 'object' && db.price ? (db.price as any).amount : (typeof db.price === 'number' ? db.price : 0));
          return aPrice - bPrice;
        }
        case 'price_desc': {
          const aPrice = (da as any).priceV2?.amount || (typeof da.price === 'object' && da.price ? (da.price as any).amount : (typeof da.price === 'number' ? da.price : 0));
          const bPrice = (db as any).priceV2?.amount || (typeof db.price === 'object' && db.price ? (db.price as any).amount : (typeof db.price === 'number' ? db.price : 0));
          return bPrice - aPrice;
        }
        case 'rating_desc':
          return ((db as any).rating || 0) - ((da as any).rating || 0);
        case 'newest':
          return new Date((db as any).createdAt || 0).getTime() - new Date((da as any).createdAt || 0).getTime();
        case 'discount_desc':
          if (da.originalPrice && db.originalPrice) {
            const aPrice = (da as any).priceV2?.amount || (typeof da.price === 'object' && da.price ? (da.price as any).amount : (typeof da.price === 'number' ? da.price : 0));
            const bPrice = (db as any).priceV2?.amount || (typeof db.price === 'object' && db.price ? (db.price as any).amount : (typeof db.price === 'number' ? db.price : 0));
            const aDiscount = ((da.originalPrice - aPrice) / da.originalPrice) * 100;
            const bDiscount = ((db.originalPrice - bPrice) / db.originalPrice) * 100;
            return bDiscount - aDiscount;
          }
          return 0;
        case 'popularity':
          return ((db as any).marketing?.ordersCount || 0) - ((da as any).marketing?.ordersCount || 0);
        case 'hot':
        default:
          return ((db as any).temperature || 0) - ((da as any).temperature || 0);
      }
    });

    return filtered.slice(0, limitCount) as Deal[];
  } catch (err) {
    console.error('Error filtering deals:', err);
    return [] as Deal[];
  }
}

export async function getDealsCountData(filters: {
  categoryId?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
  status?: string;
} = {}): Promise<number> {
  try {
    const constraints = [where('status', '==', filters.status || 'approved')];

    if (filters.categoryId) {
      constraints.push(where('mainCategorySlug', '==', filters.categoryId));
    }

    if (filters.subCategorySlug) {
      constraints.push(where('subCategorySlug', '==', filters.subCategorySlug));
    }

    if (filters.subSubCategorySlug) {
      constraints.push(where('subSubCategorySlug', '==', filters.subSubCategorySlug));
    }

    try {
      const q = query(collection(db, 'deals'), ...constraints);
      const snap = await getCountFromServer(q);
      return snap.data().count || 0;
    } catch (error: any) {
      const message = String(error?.message || '');
      const isIndexIssue = message.includes('index') || message.includes('FAILED_PRECONDITION');
      if (!isIndexIssue) throw error;

      const fallbackQ = query(
        collection(db, 'deals'),
        where('status', '==', filters.status || 'approved')
      );
      const fallbackSnap = await getDocs(fallbackQ);

      return fallbackSnap.docs.filter((docSnap) => {
        const deal = docToDeal(docSnap);
        if (filters.categoryId && deal.mainCategorySlug !== filters.categoryId) return false;
        if (filters.subCategorySlug && deal.subCategorySlug !== filters.subCategorySlug) return false;
        if (filters.subSubCategorySlug && deal.subSubCategorySlug !== filters.subSubCategorySlug) return false;
        return true;
      }).length;
    }
  } catch (err) {
    console.error('Error counting deals:', err);
    return 0;
  }
}
