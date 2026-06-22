import { NextResponse } from 'next/server';
import { cacheGet, cacheSet, rateLimit } from '@/lib/cache';
import { promises as fs } from 'fs';
import path from 'path';
import { searchProductsTypesense, searchDealsTypesense, getDealByIdTypesense } from '@/lib/search-server';

const DEFAULT_TTL = 60; // seconds

type CategoryNode = {
  slug?: string;
  seoKeywords?: string[];
  subcategories?: CategoryNode[];
};

type SeoRoutingTarget = {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
};

let seoKeywordMapCache: Map<string, SeoRoutingTarget> | null = null;

function normalizeKeyword(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function loadSeoKeywordMap(): Promise<Map<string, SeoRoutingTarget>> {
  if (seoKeywordMapCache) return seoKeywordMapCache;

  const primaryPath = path.resolve(process.cwd(), 'category-tree-seo-extended.json');
  const fallbackPath = path.resolve(process.cwd(), 'category-tree.full.json');

  let raw: string;
  try {
    raw = await fs.readFile(primaryPath, 'utf8');
  } catch {
    raw = await fs.readFile(fallbackPath, 'utf8');
  }

  const parsed = JSON.parse(raw) as { tree?: CategoryNode[] };
  const map = new Map<string, SeoRoutingTarget>();

  const addKeywords = (keywords: string[] | undefined, target: SeoRoutingTarget) => {
    if (!Array.isArray(keywords)) return;
    for (const keyword of keywords) {
      if (typeof keyword !== 'string') continue;
      const normalized = normalizeKeyword(keyword);
      if (!normalized) continue;
      if (!map.has(normalized)) map.set(normalized, target);
    }
  };

  for (const main of parsed.tree || []) {
    const mainSlug = main.slug;
    if (!mainSlug) continue;
    addKeywords(main.seoKeywords, { mainCategorySlug: mainSlug });

    for (const sub of main.subcategories || []) {
      const subSlug = sub.slug;
      if (!subSlug) continue;
      addKeywords(sub.seoKeywords, {
        mainCategorySlug: mainSlug,
        subCategorySlug: subSlug,
      });

      for (const subSub of sub.subcategories || []) {
        const subSubSlug = subSub.slug;
        if (!subSubSlug) continue;
        addKeywords(subSub.seoKeywords, {
          mainCategorySlug: mainSlug,
          subCategorySlug: subSlug,
          subSubCategorySlug: subSubSlug,
        });
      }
    }
  }

  seoKeywordMapCache = map;
  return map;
}

async function resolveSeoRoutingTarget(queryText: string): Promise<SeoRoutingTarget | null> {
  const normalizedQuery = normalizeKeyword(queryText);
  if (!normalizedQuery || normalizedQuery === '*') return null;

  const map = await loadSeoKeywordMap();
  if (map.has(normalizedQuery)) return map.get(normalizedQuery) || null;

  for (const [keyword, target] of map.entries()) {
    if (normalizedQuery.includes(keyword) || keyword.includes(normalizedQuery)) {
      return target;
    }
  }

  return null;
}

function getIp(request: Request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const qParam = (url.searchParams.get('q') || '').trim();
  const q = qParam.length > 0 ? qParam : '*';
  const type = url.searchParams.get('type') || 'all'; // products|deals|all
  const limit = Number(url.searchParams.get('limit') || '50');
  // optional filters
  let mainCategorySlug = url.searchParams.get('mainCategorySlug') || '';
  let subCategorySlug = url.searchParams.get('subCategorySlug') || '';
  let subSubCategorySlug = url.searchParams.get('subSubCategorySlug') || '';
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');
  const minRating = url.searchParams.get('minRating');
  const minTemperature = url.searchParams.get('minTemperature');
  const sort = url.searchParams.get('sort') || '';
  const statusFilter = url.searchParams.get('status') || 'approved';
  const dealId = (url.searchParams.get('dealId') || '').trim();

  if (!q || q.trim().length < 1) return NextResponse.json({ products: [], deals: [] });

  // If query maps to category SEO keyword, auto-apply category filters.
  if (!mainCategorySlug && !subCategorySlug && !subSubCategorySlug && q !== '*') {
    try {
      const seoTarget = await resolveSeoRoutingTarget(q);
      if (seoTarget) {
        mainCategorySlug = seoTarget.mainCategorySlug || '';
        subCategorySlug = seoTarget.subCategorySlug || '';
        subSubCategorySlug = seoTarget.subSubCategorySlug || '';
      }
    } catch (error) {
      console.warn('SEO keyword routing skipped:', error);
    }
  }

  // Rate-limit per IP
  const ip = getIp(request);
  const allowed = await rateLimit(ip, 60, 60);
  if (!allowed) return NextResponse.json({ error: 'rate_limited', message: 'Too many requests' }, { status: 429 });

  const key = `search:${type}:${q}:${limit}:${mainCategorySlug}:${subCategorySlug}:${subSubCategorySlug}:${minPrice}:${maxPrice}:${minRating}:${minTemperature}:${sort}:${statusFilter}:${dealId}`;
  const cached = await cacheGet(key);
  if (cached) return NextResponse.json(cached as any);

  try {
    let products: any[] = [];
    let deals: any[] = [];

    // If dealId is provided, fetch just that single deal
    if (dealId) {
      const deal = await getDealByIdTypesense(dealId);
      deals = deal ? [deal] : [];
    } else {
      const tasks: Promise<any>[] = [];

      // 1. Products search
      if (type === 'products' || type === 'all') {
        const prodSort = sort === 'price_asc' ? 'price_asc' : sort === 'price_desc' ? 'price_desc' : sort === 'rating' ? 'rating' : sort === 'popularity' ? 'popularity' : sort === 'newest' ? 'newest' : 'relevance';
        tasks.push(
          searchProductsTypesense(q, {
            mainCategorySlug: mainCategorySlug || undefined,
            subCategorySlug: subCategorySlug || undefined,
            subSubCategorySlug: subSubCategorySlug || undefined,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            minRating: minRating ? Number(minRating) : undefined,
            limit,
            sortBy: prodSort as any,
            statusFilter: statusFilter as any,
          }).then(res => { products = res; })
        );
      }

      // 2. Deals search
      if (type === 'deals' || type === 'all') {
        const dealSort = sort === 'temperature' || sort === 'hot' ? 'hot' : sort === 'price_asc' ? 'price_asc' : sort === 'price_desc' ? 'price_desc' : sort === 'newest' ? 'newest' : sort === 'popularity' ? 'popularity' : sort === 'discount_desc' ? 'discount_desc' : 'relevance';
        tasks.push(
          searchDealsTypesense(q, {
            mainCategorySlug: mainCategorySlug || undefined,
            subCategorySlug: subCategorySlug || undefined,
            subSubCategorySlug: subSubCategorySlug || undefined,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            minTemperature: minTemperature ? Number(minTemperature) : undefined,
            limit,
            sortBy: dealSort as any,
            statusFilter: statusFilter as any,
          }).then(res => { deals = res; })
        );
      }

      await Promise.all(tasks);
    }

    const out = { products, deals };
    await cacheSet(key, out, DEFAULT_TTL);
    return NextResponse.json(out);
  } catch (e: any) {
    console.warn('Search API error:', e);
    // Return error information to assist debugging on dev environments
    const errorPayload: any = { products: [], deals: [] };
    if (process.env.NODE_ENV === 'development') {
      errorPayload.error = e?.message || String(e);
      errorPayload.stack = e?.stack;
    }
    return NextResponse.json(errorPayload);
  }
}
