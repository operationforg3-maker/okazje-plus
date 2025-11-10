import { NextResponse } from 'next/server';
import { buildSignedParams, toQueryString } from '@/lib/aliexpress';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || url.searchParams.get('itemId') || '';

  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const API_BASE = process.env.ALIEXPRESS_API_BASE;
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY || process.env.ALIEXPRESS_API_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;

  if (!API_BASE) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  try {
    const userParams: Record<string, string | number | boolean> = { itemId: id };
    let forwardUrlStr: string;

    if (APP_KEY && APP_SECRET) {
      const signed = buildSignedParams(userParams, String(APP_KEY), String(APP_SECRET));
      forwardUrlStr = `${API_BASE.replace(/\/$/, '')}?${toQueryString(signed)}`;
    } else {
      const u = new URL(API_BASE);
      u.searchParams.set('itemId', id);
      forwardUrlStr = u.toString();
    }

    const res = await fetch(forwardUrlStr, { next: { revalidate: 30 } });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: 'upstream_error', status: res.status, body: text }, { status: 502 });
    }
    const body = await res.json();

    // Normalize common shapes
    if (body.product) return NextResponse.json({ product: body.product });
    if (body.item) return NextResponse.json({ product: body.item });
    if (body.data) return NextResponse.json({ product: body.data });

    return NextResponse.json({ raw: body });
  } catch (e) {
    console.error('AliExpress item proxy failed:', e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
