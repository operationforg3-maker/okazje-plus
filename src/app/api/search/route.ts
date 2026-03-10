import { NextResponse } from 'next/server';
import typesenseServerClient from '@/lib/typesense-server';
import { cacheGet, cacheSet, rateLimit } from '@/lib/cache';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_TTL = 60; // seconds
const FALLBACK_DEAL_IMAGE = '/icon_okazjeplus.svg';

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

function ensureString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function parseLocalizedStringPayload(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const tryExtractFromObject = (obj: Record<string, unknown>): string => {
    const preferred = [obj.pl, obj.en, obj.de, ...Object.values(obj)]
      .find((entry) => typeof entry === 'string' && String(entry).trim().length > 0);
    return typeof preferred === 'string' ? preferred.trim() : '';
  };

  const tryParse = (input: string): string => {
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === 'string' && parsed !== input) return tryParse(parsed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return tryExtractFromObject(parsed as Record<string, unknown>);
      }
    } catch {
      // ignored on purpose
    }
    return '';
  };

  return tryParse(trimmed) || trimmed;
}

function normalizeLocalizedField(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  const raw = ensureString(value);
  const parsed = parseLocalizedStringPayload(raw);
  if (!parsed) return { pl: '', en: '' };
  return { pl: parsed, en: parsed };
}

function resolveImageCandidate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = resolveImageCandidate(entry);
      if (resolved) return resolved;
    }
    return undefined;
  }
  if (typeof value === 'object') {
    const candidate = (value as any).src || (value as any).url || (value as any).image || (value as any).imageUrl;
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : undefined;
  }
  return undefined;
}

function resolveDealImage(doc: any): string {
  const candidates = [
    doc?.image,
    doc?.imageUrl,
    doc?.mainImage,
    doc?.product_main_image_url,
    doc?.thumbnail,
    doc?.images,
    doc?.gallery,
    doc?.metadata?.image,
    doc?.metadata?.imageUrl,
    doc?.metadata?.mainImage,
    doc?.importMetadata?.image,
    doc?.importMetadata?.imageUrl,
    doc?.importMetadata?.mainImage,
  ];

  for (const candidate of candidates) {
    const resolved = resolveImageCandidate(candidate);
    if (resolved) return resolved;
  }

  return '/icon_okazjeplus.svg';
}

function normalizeDealDocument(doc: any): any {
  return {
    ...doc,
    title: normalizeLocalizedField(doc?.title),
    description: normalizeLocalizedField(doc?.description),
    image: resolveDealImage(doc),
  };
}

function chunkIds(ids: string[], chunkSize = 30): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  return chunks;
}

async function hydrateFallbackDealImages(deals: any[]): Promise<any[]> {
  const idsToHydrate = deals
    .filter((deal) => !deal?.image || deal.image === FALLBACK_DEAL_IMAGE)
    .map((deal) => String(deal.id || ''))
    .filter(Boolean);

  if (idsToHydrate.length === 0) return deals;

  const resolved = new Map<string, string>();
  const batches = chunkIds([...new Set(idsToHydrate)]);

  await Promise.all(
    batches.map(async (batch) => {
      const snap = await getDocs(query(collection(db, 'deals'), where(documentId(), 'in', batch)));
      snap.docs.forEach((docSnap) => {
        const raw = docSnap.data() as any;
        const image = resolveDealImage(raw);
        if (image && image !== FALLBACK_DEAL_IMAGE) {
          resolved.set(docSnap.id, image);
        }
      });
    })
  );

  if (resolved.size === 0) return deals;

  return deals.map((deal) => {
    const hydrated = resolved.get(String(deal.id || ''));
    if (!hydrated) return deal;
    return { ...deal, image: hydrated };
  });
}

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

  // final.md: if query maps to category SEO keyword, auto-apply category filters.
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

  // rate-limit per IP (requires Redis). If Redis not configured, rateLimit() allows requests.
  const ip = getIp(request);
  const allowed = await rateLimit(ip, 60, 60);
  if (!allowed) return NextResponse.json({ error: 'rate_limited', message: 'Too many requests' }, { status: 429 });

  const key = `search:${type}:${q}:${limit}:${mainCategorySlug}:${subCategorySlug}:${subSubCategorySlug}:${minPrice}:${maxPrice}:${minRating}:${minTemperature}:${sort}:${statusFilter}:${dealId}`;
  const cached = await cacheGet(key);
  if (cached) return NextResponse.json(cached as any);

  try {
    if (!typesenseServerClient) {
      return NextResponse.json(
        {
          error: 'typesense_unavailable',
          message: 'Wyszukiwarka jest chwilowo niedostępna. Spróbuj ponownie za chwilę.',
          products: [],
          deals: [],
        },
        { status: 503 }
      );
    }

    const tasks: Promise<any>[] = [];
    if (type === 'products' || type === 'all') {
      const productFilters: string[] = [];
      if (mainCategorySlug) productFilters.push(`mainCategorySlug:=${mainCategorySlug}`);
      if (subCategorySlug) productFilters.push(`subCategorySlug:=${subCategorySlug}`);
      if (subSubCategorySlug) productFilters.push(`subSubCategorySlug:=${subSubCategorySlug}`);
      if (minPrice) productFilters.push(`price:>=${Number(minPrice)}`);
      if (maxPrice) productFilters.push(`price:<=${Number(maxPrice)}`);
      if (minRating) productFilters.push(`ratingCard.average:>=${Number(minRating)}`);
      if (statusFilter === 'waiting_room' || statusFilter === 'poczekalnia') {
        productFilters.push('status:=[pending_approval,approval,pending,poczekalnia]');
      } else {
        productFilters.push('status:=approved');
      }

      tasks.push(typesenseServerClient.collections('products').documents().search({ 
        q, 
        query_by: 'name,description', 
        per_page: limit,
        filter_by: productFilters.join(' && '),
      }, {}));
    } else {
      tasks.push(Promise.resolve({ hits: [] }));
    }
    if (type === 'deals' || type === 'all') {
      // Build filters
      const filters: string[] = [];
      if (mainCategorySlug) filters.push(`mainCategorySlug:=${mainCategorySlug}`);
      if (subCategorySlug) filters.push(`subCategorySlug:=${subCategorySlug}`);
      if (subSubCategorySlug) filters.push(`subSubCategorySlug:=${subSubCategorySlug}`);
      if (dealId) filters.push(`id:=${dealId}`);
      if (minPrice) filters.push(`price:>=${Number(minPrice)}`);
      if (maxPrice) filters.push(`price:<=${Number(maxPrice)}`);
      if (minTemperature) filters.push(`temperature:>=${Number(minTemperature)}`);
      if (statusFilter === 'waiting_room' || statusFilter === 'poczekalnia') {
        filters.push('status:=[pending,poczekalnia,pending_approval,approval]');
      } else {
        filters.push('status:=approved');
      }

      // Sorting
      let sort_by = '';
      switch (sort) {
        case 'temperature': sort_by = 'temperature:desc'; break;
        case 'price_asc': sort_by = 'price:asc'; break;
        case 'price_desc': sort_by = 'price:desc'; break;
        case 'newest': sort_by = 'postedAt:desc'; break;
        default: sort_by = '_text_match:desc';
      }

      tasks.push(typesenseServerClient.collections('deals').documents().search({ 
        q, 
        query_by: 'title,description', 
        per_page: limit,
        filter_by: filters.join(' && '),
        sort_by
      }, {}));
    } else {
      tasks.push(Promise.resolve({ hits: [] }));
    }

    const [prodRes, dealRes] = await Promise.all(tasks);
    const products = (prodRes.hits || []).map((h: any) => ({ id: h.document.id, ...h.document }));
    const normalizedDeals = (dealRes.hits || []).map((h: any) => normalizeDealDocument({ id: h.document.id, ...h.document }));
    const deals = await hydrateFallbackDealImages(normalizedDeals);

    const out = { products, deals };
    await cacheSet(key, out, DEFAULT_TTL);
    return NextResponse.json(out);
  } catch (e) {
    console.warn('Search API error:', e);
    return NextResponse.json({ products: [], deals: [] });
  }
}
