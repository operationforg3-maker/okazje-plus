import { NextResponse } from 'next/server';
import typesenseServerClient from '@/lib/typesense-server';
import { cacheGet, cacheSet, rateLimit } from '@/lib/cache';

const DEFAULT_TTL = 60; // seconds

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
  const q = url.searchParams.get('q') || '';
  const type = url.searchParams.get('type') || 'all'; // products|deals|all
  const limit = Number(url.searchParams.get('limit') || '50');

  if (!q || q.trim().length < 1) return NextResponse.json({ products: [], deals: [] });

  // rate-limit per IP (requires Redis). If Redis not configured, rateLimit() allows requests.
  const ip = getIp(request);
  const allowed = await rateLimit(ip, 60, 60);
  if (!allowed) return NextResponse.json({ error: 'rate_limited', message: 'Too many requests' }, { status: 429 });

  const key = `search:${type}:${q}:${limit}`;
  const cached = await cacheGet(key);
  if (cached) return NextResponse.json(cached as any);

  try {
    if (!typesenseServerClient) {
      // Fallback to Firestore search. First try the existing fast helpers (which use
      // indexed range queries). If they return nothing (because the query is a
      // substring or starts later in the title), perform a broader in-memory
      // filter over a larger set (recommended/hot) to improve recall.
      const { searchProducts, searchDeals, getRecommendedProducts, getHotDeals } = await import('@/lib/data');

      let products: any[] = [];
      let deals: any[] = [];

      if (type !== 'deals') {
        try {
          products = (await searchProducts(q)) || [];
        } catch (err) {
          products = [];
        }
        if (!products || products.length === 0) {
          // Broader scan (limited) with substring match
          const candidates = await getRecommendedProducts(200);
          const nq = q.toLowerCase();
          products = candidates.filter((p: any) => ((p.name || '') + ' ' + (p.description || '')).toLowerCase().includes(nq)).slice(0, limit);
        } else {
          products = products.slice(0, limit);
        }
      }

      if (type !== 'products') {
        try {
          deals = (await (searchDeals ? searchDeals(q) : Promise.resolve([]))) || [];
        } catch (err) {
          deals = [];
        }
        if (!deals || deals.length === 0) {
          const candidates = await getHotDeals(200);
          const nq = q.toLowerCase();
          deals = candidates.filter((d: any) => ((d.title || '') + ' ' + (d.description || '')).toLowerCase().includes(nq)).slice(0, limit);
        } else {
          deals = deals.slice(0, limit);
        }
      }

      const out = { products, deals };
      await cacheSet(key, out, DEFAULT_TTL);
      return NextResponse.json(out);
    }

    const tasks: Promise<any>[] = [];
    if (type === 'products' || type === 'all') {
      tasks.push(typesenseServerClient.collections('products').documents().search({ q, query_by: 'name,description', per_page: limit }, {}));
    } else {
      tasks.push(Promise.resolve({ hits: [] }));
    }
    if (type === 'deals' || type === 'all') {
      tasks.push(typesenseServerClient.collections('deals').documents().search({ q, query_by: 'title,description', per_page: limit }, {}));
    } else {
      tasks.push(Promise.resolve({ hits: [] }));
    }

    const [prodRes, dealRes] = await Promise.all(tasks);
    const products = (prodRes.hits || []).map((h: any) => ({ id: h.document.id, ...h.document }));
    const deals = (dealRes.hits || []).map((h: any) => ({ id: h.document.id, ...h.document }));

    const out = { products, deals };
    await cacheSet(key, out, DEFAULT_TTL);
    return NextResponse.json(out);
  } catch (e) {
    console.warn('Search API error:', e);
    return NextResponse.json({ products: [], deals: [] });
  }
}
