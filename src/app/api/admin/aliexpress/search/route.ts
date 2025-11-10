import { NextResponse } from 'next/server';
import { buildSignedParams, toQueryString } from '@/lib/aliexpress';

// Use official AliExpress Open Platform flow when APP KEY + SECRET provided.
// The implementation constructs signed params and forwards the request server-side.

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category') || '';
  const minPrice = url.searchParams.get('minPrice') || '';
  const maxPrice = url.searchParams.get('maxPrice') || '';
  const limit = Number(url.searchParams.get('limit') || '50');

  if (!q || q.trim().length < 1) {
    return NextResponse.json({ products: [] });
  }

  const API_BASE = process.env.ALIEXPRESS_API_BASE;
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY || process.env.ALIEXPRESS_API_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;

  if (!API_BASE) {
    return NextResponse.json({ error: 'not_configured', message: 'Set ALIEXPRESS_API_BASE in server env to enable real import.' }, { status: 503 });
  }

  try {
    const userParams: Record<string, string | number | boolean> = {
      q,
      category,
      minPrice,
      maxPrice,
      limit,
    };

    let forwardUrlStr: string;

    if (APP_KEY && APP_SECRET) {
      // Build signed AOP params
      const signed = buildSignedParams(userParams, String(APP_KEY), String(APP_SECRET));
      const qs = toQueryString(signed);
      forwardUrlStr = `${API_BASE.replace(/\/$/, '')}?${qs}`;
    } else {
      // Fallback: simple proxy with API key header if provided
      const u = new URL(API_BASE);
      u.searchParams.set('q', q);
      if (category) u.searchParams.set('category', category);
      if (minPrice) u.searchParams.set('minPrice', minPrice);
      if (maxPrice) u.searchParams.set('maxPrice', maxPrice);
      u.searchParams.set('limit', String(limit));
      forwardUrlStr = u.toString();
    }

    const headers: Record<string, string> = {};
    if (!APP_KEY || !APP_SECRET) {
      const API_KEY = process.env.ALIEXPRESS_API_KEY;
      if (API_KEY) {
        headers[process.env.ALIEXPRESS_API_KEY_HEADER || 'Authorization'] = process.env.ALIEXPRESS_API_KEY_HEADER ? API_KEY : `Bearer ${API_KEY}`;
      }
    }

    const res = await fetch(forwardUrlStr, { headers, next: { revalidate: 30 } });

    if (!res.ok) {
      const text = await res.text();
      console.warn('AliExpress proxy returned non-OK:', res.status, text);
      return NextResponse.json({ error: 'upstream_error', status: res.status, body: text }, { status: 502 });
    }

    const body = await res.json();

    if (Array.isArray(body.products)) return NextResponse.json({ products: body.products });
    if (Array.isArray(body.results)) return NextResponse.json({ products: body.results });

    return NextResponse.json({ products: [], raw: body });
  } catch (e) {
    console.error('AliExpress proxy error:', e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
