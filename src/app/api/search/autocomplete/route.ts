import { NextResponse } from 'next/server';
import typesenseServerClient from '@/lib/typesense-server';
import { cacheGet, cacheSet, rateLimit } from '@/lib/cache';

const DEFAULT_TTL = 120; // seconds

function stripHtmlTags(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';

  return value
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSuggestion(document: any, type: 'product' | 'deal') {
  const id = typeof document?.id === 'string' ? document.id : '';
  if (!id) return null;

  const rawLabel = type === 'deal'
    ? document?.title ?? document?.name ?? document?.description
    : document?.name ?? document?.title ?? document?.description;
  const rawSubLabel = type === 'deal'
    ? document?.description ?? document?.title
    : document?.description ?? document?.name;

  const label = stripHtmlTags(rawLabel);
  const subLabel = stripHtmlTags(rawSubLabel);

  if (!label) return null;

  return {
    type,
    id,
    label,
    subLabel: subLabel && subLabel !== label ? subLabel : undefined,
  };
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
    const searches = [
      { collection: 'products', q, query_by: 'name,description', per_page: limit, highlight_full_fields: 'name', prefix: true },
      { collection: 'deals', q, query_by: 'title,description', per_page: limit, highlight_full_fields: 'title', prefix: true },
    ];
    const searchRequest = {
      searches: [
        ...searches,
      ],
    } as any;

    const res = await (typesenseServerClient as any).multiSearch.perform(searchRequest, {});
    const out: any[] = [];
    for (const [index, r] of (res.results || []).entries()) {
      const collectionName = searches[index]?.collection;
      const type: 'product' | 'deal' = collectionName === 'deals' ? 'deal' : 'product';
      for (const h of r.hits || []) {
        const suggestion = normalizeSuggestion(h.document, type);
        if (suggestion) {
          out.push(suggestion);
        }
      }
    }

    await cacheSet(key, out, DEFAULT_TTL);
    return NextResponse.json(out);
  } catch (e) {
    console.warn('Autocomplete API error:', e);
    return NextResponse.json([], { status: 200 });
  }
}
