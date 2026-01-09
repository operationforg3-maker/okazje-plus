import { NextResponse } from 'next/server';

/**
 * Advanced: Batch Search
 * Przyjmuje tablicę zapytań i zwraca zmergowane, zdeduplikowane wyniki.
 * Minimalizuje liczbę wywołań z frontendu/flow.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { queries, limit = 8 } = body || {};
    if (!Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json({ error: 'invalid_input', message: 'queries[] required' }, { status: 400 });
    }

    const baseUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'}/api/admin/aliexpress/search`;
    const seen = new Set<string>();
    const merged: any[] = [];

    for (const q of queries) {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const products = data.products || [];
      for (const p of products) {
        const key = p.id || p.productId || p.itemId || p.productUrl || p.link || '';
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(p);
      }
    }

    return NextResponse.json({ products: merged, queriesCount: queries.length });
  } catch (e) {
    console.error('[Advanced Batch Search] Failed:', e);
    return NextResponse.json({ error: 'failed', message: String(e) }, { status: 500 });
  }
}
