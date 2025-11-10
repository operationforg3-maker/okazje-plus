import { NextResponse } from 'next/server';
import typesenseServerClient from '@/lib/typesense-server';
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, any[]>({ max: 500, ttl: 1000 * 60 * 2 }); // 2 min cache

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const limit = Number(url.searchParams.get('limit') || '5');

  if (!q || q.trim().length < 2) return NextResponse.json([], { status: 200 });

  const key = `autocomplete:${q}:${limit}`;
  const cached = cache.get(key);
  if (cached) return NextResponse.json(cached);

  try {
    if (!typesenseServerClient) {
      // Fallback to Firestore-based autocomplete implemented here
      const { searchProducts, getHotDeals } = await import('@/lib/data');
      const normalizedQuery = q.toLowerCase().trim();
      const [products, deals] = await Promise.all([
        searchProducts(q).then(p => p.slice(0, limit)),
        getHotDeals(limit),
      ]);

      const out: any[] = [];
      products
        .filter(p => p.name.toLowerCase().includes(normalizedQuery) || p.description?.toLowerCase().includes(normalizedQuery))
        .slice(0, limit)
        .forEach(p => out.push({ type: 'product', id: p.id, label: p.name, subLabel: p.description }));

      deals
        .filter(d => d.title.toLowerCase().includes(normalizedQuery) || d.description?.toLowerCase().includes(normalizedQuery))
        .slice(0, Math.max(0, limit - out.length))
        .forEach(d => out.push({ type: 'deal', id: d.id, label: d.title, subLabel: d.description }));

      cache.set(key, out);
      return NextResponse.json(out);
    }

    // Use multi-search to get products + deals
    const searches = {
      searches: [
        { collection: 'products', q, query_by: 'name,description', per_page: limit, highlight_full_fields: 'name', prefix: true },
        { collection: 'deals', q, query_by: 'title,description', per_page: limit, highlight_full_fields: 'title', prefix: true },
      ],
    } as any;

    const res = await (typesenseServerClient as any).multiSearch.perform(searches, {});
    const out: any[] = [];
    for (const r of res.results || []) {
      const isDeal = r.request_params.collection === 'deals';
      for (const h of r.hits || []) {
        const doc = h.document;
        out.push({ type: isDeal ? 'deal' : 'product', id: doc.id, label: isDeal ? doc.title : doc.name, subLabel: doc.description });
      }
    }

    cache.set(key, out);
    return NextResponse.json(out);
  } catch (e) {
    console.warn('Autocomplete API error:', e);
    return NextResponse.json([], { status: 200 });
  }
}
