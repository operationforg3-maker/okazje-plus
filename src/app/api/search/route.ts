import { NextResponse } from 'next/server';
import typesenseServerClient from '@/lib/typesense-server';
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, any>({ max: 500, ttl: 1000 * 60 * 1 }); // 1 min cache

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const type = url.searchParams.get('type') || 'all'; // products|deals|all
  const limit = Number(url.searchParams.get('limit') || '50');

  if (!q || q.trim().length < 1) return NextResponse.json({ products: [], deals: [] });
  const key = `search:${type}:${q}:${limit}`;
  const cached = cache.get(key);
  if (cached) return NextResponse.json(cached as any);

  try {
    if (!typesenseServerClient) {
      // Fallback to Firestore search
      const { searchProducts, searchDeals } = await import('@/lib/data');
      const [products, deals] = await Promise.all([
        type === 'deals' ? Promise.resolve([]) : searchProducts(q).then(p => p.slice(0, limit)),
        type === 'products' ? Promise.resolve([]) : searchDeals ? searchDeals(q).then(d => d.slice(0, limit)) : Promise.resolve([]),
      ]);
  const out = { products, deals };
  cache.set(key, out);
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
  cache.set(key, out);
    return NextResponse.json(out);
  } catch (e) {
    console.warn('Search API error:', e);
    return NextResponse.json({ products: [], deals: [] });
  }
}
