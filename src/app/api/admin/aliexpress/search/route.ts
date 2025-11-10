import { NextResponse } from 'next/server';

// This is a configurable proxy endpoint for AliExpress API calls.
// It supports a simple forwarding mode when ALIEXPRESS_API_BASE and ALIEXPRESS_API_KEY are provided.
// For other integration types you can extend this route to implement signature-based calls.

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
  const API_KEY = process.env.ALIEXPRESS_API_KEY;

  if (!API_BASE || !API_KEY) {
    return NextResponse.json({ error: 'not_configured', message: 'Set ALIEXPRESS_API_BASE and ALIEXPRESS_API_KEY in server env to enable real import.' }, { status: 503 });
  }

  try {
    // Build forwarding URL — provider-specific. Expecting the external API to accept q, category, minPrice, maxPrice, limit as query params.
    const forwardUrl = new URL(API_BASE);
    forwardUrl.searchParams.set('q', q);
    if (category) forwardUrl.searchParams.set('category', category);
    if (minPrice) forwardUrl.searchParams.set('minPrice', minPrice);
    if (maxPrice) forwardUrl.searchParams.set('maxPrice', maxPrice);
    forwardUrl.searchParams.set('limit', String(limit));

    const res = await fetch(forwardUrl.toString(), {
      headers: {
        // Common pattern: an API key header. If your provider uses another header, set ALIEXPRESS_API_KEY_HEADER env.
        [process.env.ALIEXPRESS_API_KEY_HEADER || 'Authorization']: process.env.ALIEXPRESS_API_KEY_HEADER ? API_KEY : `Bearer ${API_KEY}`,
      },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn('AliExpress proxy returned non-OK:', res.status, text);
      return NextResponse.json({ error: 'upstream_error', status: res.status, body: text }, { status: 502 });
    }

    const body = await res.json();

    // Expect body to contain an array `products` or raw provider format. Normalize to our AliExpressProduct shape where possible.
    // If provider returns a different shape, you can customize parsing here.
    if (Array.isArray(body.products)) {
      return NextResponse.json({ products: body.products });
    }

    // Try to detect common RapidAPI response structure
    if (Array.isArray(body.results)) {
      return NextResponse.json({ products: body.results });
    }

    // Unknown shape — return raw body for client-side inspection
    return NextResponse.json({ products: [], raw: body });
  } catch (e) {
    console.error('AliExpress proxy error:', e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
