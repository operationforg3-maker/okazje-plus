import { NextResponse } from 'next/server';
import { getAutocompleteSuggestions } from '@/lib/search-server';
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
  const locale = url.searchParams.get('locale') || 'pl';

  if (!q || q.trim().length < 2) return NextResponse.json([], { status: 200 });

  // Rate-limit autocomplete more strictly
  const ip = getIp(request);
  const allowed = await rateLimit(ip, 30, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests' },
      { status: 429 }
    );
  }

  const key = `autocomplete:${locale}:${q}:${limit}`;
  const cached = await cacheGet(key);
  if (cached) return NextResponse.json(cached);

  try {
    const out = await getAutocompleteSuggestions(q, limit, locale);
    await cacheSet(key, out, DEFAULT_TTL);
    return NextResponse.json(out);
  } catch (e) {
    console.warn('Autocomplete API error:', e);
    return NextResponse.json([], { status: 200 });
  }
}
