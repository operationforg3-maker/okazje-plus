import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { cacheGet, cacheSet } from '@/lib/cache';
import { sanitizeProductCoreRecord } from '@/lib/sanitizers';

type ProductStatusFilter = 'approved' | 'waiting_room';
type ProductSort = 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'hot' | 'relevance' | 'popularity';

type QueryBody = {
  filters?: {
    priceRange?: { min: number; max: number };
    minRating?: number;
    categoryId?: string;
    subCategorySlug?: string;
    subSubCategorySlug?: string;
    brands?: string[];
    searchTerm?: string;
    statusFilter?: ProductStatusFilter;
  };
  sortBy?: ProductSort;
  limit?: number;
};

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 48;
const CACHE_TTL_SECONDS = 45;

function normalizeLimit(limitInput: unknown): number {
  const parsed = Number(limitInput);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function listingProjection(product: any) {
  const tags = Array.isArray(product?.metadata?.tags) ? product.metadata.tags.slice(0, 8) : [];

  // ProductCore nie ma pola `image` — resolve z images[] lub imageUrl
  const primaryImage: string | undefined =
    (Array.isArray(product.images) && product.images[0]) ||
    product.imageUrl ||
    undefined;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    title: product.title,
    shortDescription: product.shortDescription,
    description: product.description,
    bestPrice: product.bestPrice,
    rating: product.rating,
    image: primaryImage,                                              // ← fix: wcześniej zawsze undefined
    images: Array.isArray(product.images) ? product.images.slice(0, 4) : [],
    gallery: Array.isArray(product.gallery) ? product.gallery.slice(0, 4) : [],
    affiliateUrl: product.affiliateUrl,
    updatedAt: product.updatedAt,
    mainCategorySlug: product.mainCategorySlug,
    subCategorySlug: product.subCategorySlug,
    subSubCategorySlug: product.subSubCategorySlug,
    status: product.status,
    metadata: {
      brand: product?.metadata?.brand,
      tags,
      shipping: product?.metadata?.shipping,
    },
  };
}


function normalizeSearchText(value: unknown): string {
  if (!value) return '';
  return String(value).toLowerCase().trim();
}

function toComparableText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return String(obj.pl || obj.en || obj.de || obj.uk || '').toLowerCase();
  }
  return String(value).toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as QueryBody;
    const filters = body.filters || {};
    const sortBy: ProductSort = body.sortBy || 'relevance';
    const limitCount = normalizeLimit(body.limit);
    const statusFilter: ProductStatusFilter = filters.statusFilter === 'waiting_room' ? 'waiting_room' : 'approved';

    const cacheKey = `public:products:query:v1:${JSON.stringify({ filters, sortBy, limitCount, statusFilter })}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const statuses = statusFilter === 'waiting_room'
      ? ['pending_approval', 'approval', 'pending', 'poczekalnia']
      : ['approved'];

    const fetchLimit = Math.max(limitCount * 2, 48);
    const snapshots = await Promise.all(
      statuses.map(async (status) => {
        let q: FirebaseFirestore.Query = adminDb.collection('product_cores').where('status', '==', status);

        if (filters.subSubCategorySlug) {
          q = q.where('subSubCategorySlug', '==', filters.subSubCategorySlug);
        } else if (filters.subCategorySlug) {
          q = q.where('subCategorySlug', '==', filters.subCategorySlug);
        } else if (filters.categoryId) {
          q = q.where('mainCategorySlug', '==', filters.categoryId);
        }

        // Try ordering by createdAt desc first so latest products are fetched
        try {
          return await q.orderBy('createdAt', 'desc').limit(fetchLimit).get();
        } catch (error: any) {
          // If composite index is missing or building, fallback to unordered query with larger limit
          try {
            return await q.limit(fetchLimit).get();
          } catch (innerError: any) {
            return await adminDb.collection('product_cores').where('status', '==', status).limit(fetchLimit * 2).get();
          }
        }
      })
    );

    const productsMap = new Map<string, any>();
    for (const snapshot of snapshots) {
      for (const docSnap of snapshot.docs) {
        if (productsMap.has(docSnap.id)) continue;
        productsMap.set(docSnap.id, sanitizeProductCoreRecord(docSnap.data(), docSnap.id));
      }
    }

    const searchNeedle = normalizeSearchText(filters.searchTerm);
    const products = Array.from(productsMap.values()).filter((product) => {
      if (filters.categoryId && product.mainCategorySlug !== filters.categoryId) return false;
      if (filters.subCategorySlug && product.subCategorySlug !== filters.subCategorySlug) return false;
      if (filters.subSubCategorySlug && product.subSubCategorySlug !== filters.subSubCategorySlug) return false;

      if (filters.priceRange) {
        const price = Number(product?.bestPrice?.amount || 0);
        if (price < Number(filters.priceRange.min || 0)) return false;
        if (price > Number(filters.priceRange.max || Number.MAX_SAFE_INTEGER)) return false;
      }

      if (filters.minRating && Number(product?.rating?.score || 0) < Number(filters.minRating)) {
        return false;
      }

      if (Array.isArray(filters.brands) && filters.brands.length > 0) {
        const brand = String(product?.metadata?.brand || '');
        if (!filters.brands.includes(brand)) return false;
      }

      if (searchNeedle) {
        const title = toComparableText(product.title);
        const desc = toComparableText(product.description || product.shortDescription);
        if (!title.includes(searchNeedle) && !desc.includes(searchNeedle)) {
          return false;
        }
      }

      return true;
    });

    const getProductTimestamp = (p: any): number => {
      const ts = p?.createdAt || p?.updatedAt;
      if (!ts) return 0;
      if (typeof ts?.toMillis === 'function') return ts.toMillis();
      if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
      if (ts instanceof Date) return ts.getTime();
      if (typeof ts === 'number') return ts;
      const parsed = Date.parse(String(ts));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const computeQualityScore = (p: any): number => {
      let score = 0;
      // High quality images
      const hasImage = (Array.isArray(p.images) && p.images.length > 0) || !!p.imageUrl;
      if (hasImage) score += 40;
      // Valid price
      const price = Number(p?.bestPrice?.amount || 0);
      if (price > 0) score += 30;
      // Rating & reviews
      const rating = Number(p?.rating?.score || 0);
      const ratingCount = Number(p?.rating?.count || 0);
      if (rating > 0) score += Math.min(rating * 4, 20);
      if (ratingCount > 0) score += Math.min(ratingCount * 2, 10);
      // Recency boost (within 14 days gets up to 15 points)
      const ts = getProductTimestamp(p);
      if (ts > 0) {
        const ageHours = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60));
        if (ageHours < 336) {
          score += Math.round((1 - ageHours / 336) * 15);
        }
      }
      return score;
    };

    products.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return Number(a?.bestPrice?.amount || 0) - Number(b?.bestPrice?.amount || 0);
        case 'price_desc':
          return Number(b?.bestPrice?.amount || 0) - Number(a?.bestPrice?.amount || 0);
        case 'rating_desc': {
          const scoreDiff = Number(b?.rating?.score || 0) - Number(a?.rating?.score || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return Number(b?.rating?.count || 0) - Number(a?.rating?.count || 0);
        }
        case 'newest':
          return getProductTimestamp(b) - getProductTimestamp(a);
        case 'popularity': {
          const ordersDiff = Number(b?.marketing?.ordersCount || 0) - Number(a?.marketing?.ordersCount || 0);
          if (ordersDiff !== 0) return ordersDiff;
          return Number(b?.rating?.count || 0) - Number(a?.rating?.count || 0);
        }
        case 'hot': {
          const hotA = (Number(a?.rating?.score || 0) * Number(a?.rating?.count || 0)) + computeQualityScore(a);
          const hotB = (Number(b?.rating?.score || 0) * Number(b?.rating?.count || 0)) + computeQualityScore(b);
          return hotB - hotA;
        }
        case 'relevance':
        default:
          return computeQualityScore(b) - computeQualityScore(a);
      }
    });

    const payload = {
      products: products.slice(0, limitCount).map(listingProjection),
      meta: {
        count: Math.min(products.length, limitCount),
        statusFilter,
        checkedAt: new Date().toISOString(),
      },
    };

    await cacheSet(cacheKey, payload, CACHE_TTL_SECONDS);
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json(
      {
        products: [],
        meta: {
          count: 0,
          error: String(error?.message || 'Internal error'),
        },
      },
      { status: 500 }
    );
  }
}
