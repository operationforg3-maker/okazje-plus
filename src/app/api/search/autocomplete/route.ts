import { NextResponse } from 'next/server';
import typesenseServerClient from '@/lib/typesense-server';
import { cacheGet, cacheSet, rateLimit } from '@/lib/cache';

const DEFAULT_TTL = 120; // seconds

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
  const limit = Number(url.searchParams.get('limit') || '5');

  if (!q || q.trim().length < 2) return NextResponse.json([], { status: 200 });

  // Rate-limit autocomplete more strictly
  const ip = getIp(request);
  const allowed = await rateLimit(ip, 30, 60);
  if (!allowed) return NextResponse.json({ error: 'rate_limited', message: 'Too many requests' }, { status: 429 });

  const key = `autocomplete:${q}:${limit}`;
  const cached = await cacheGet(key);
  if (cached) return NextResponse.json(cached);

  try {
    if (!typesenseServerClient) {
      return NextResponse.json(
        {
          error: 'typesense_unavailable',
          message: 'Autouzupełnianie jest chwilowo niedostępne. Spróbuj ponownie za chwilę.',
        },
        { status: 503 }
      );
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

    await cacheSet(key, out, DEFAULT_TTL);
    return NextResponse.json(out);
  } catch (e) {
    console.warn('Autocomplete API error:', e);
    return NextResponse.json([], { status: 200 });
  }
}
