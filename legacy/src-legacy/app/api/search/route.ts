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
  // optional filters
  const mainCategorySlug = url.searchParams.get('mainCategorySlug') || '';
  const subCategorySlug = url.searchParams.get('subCategorySlug') || '';
  const subSubCategorySlug = url.searchParams.get('subSubCategorySlug') || '';
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');
  const minRating = url.searchParams.get('minRating');
  const minTemperature = url.searchParams.get('minTemperature');
  const sort = url.searchParams.get('sort') || '';

  if (!q || q.trim().length < 1) return NextResponse.json({ products: [], deals: [] });

  // rate-limit per IP (requires Redis). If Redis not configured, rateLimit() allows requests.
  const ip = getIp(request);
  const allowed = await rateLimit(ip, 60, 60);
  if (!allowed) return NextResponse.json({ error: 'rate_limited', message: 'Too many requests' }, { status: 429 });

  const key = `search:${type}:${q}:${limit}:${mainCategorySlug}:${subCategorySlug}:${subSubCategorySlug}:${minPrice}:${maxPrice}:${minRating}:${minTemperature}:${sort}`;
  const cached = await cacheGet(key);
  if (cached) return NextResponse.json(cached as any);

  try {
    if (!typesenseServerClient) {
      // Fallback to Firestore search. First try the existing fast helpers (which use
      // indexed range queries). If they return nothing (because the query is a
      // substring or starts later in the title), perform a broader in-memory
      // filter over a larger set (recommended/hot) to improve recall.
      const timeoutData = new Promise((_, reject) => setTimeout(() => reject(new Error('lib/data import timeout (10s)')), 10000));
      const dataMod = await Promise.race([import('@/lib/data'), timeoutData]) as any;
      const { searchProducts, searchDeals, getRecommendedProducts, getHotDeals } = dataMod;

      let products: any[] = [];
      let deals: any[] = [];

      if (type !== 'deals') {
        try {
          products = (await searchProducts(q)) || [];
        } catch (err) {
          products = [];
        }
        if (products && products.length > 0) {
          if (mainCategorySlug) products = products.filter((p: any) => p.mainCategorySlug === mainCategorySlug);
          if (subCategorySlug) products = products.filter((p: any) => p.subCategorySlug === subCategorySlug);
          if (subSubCategorySlug) products = products.filter((p: any) => p.subSubCategorySlug === subSubCategorySlug);
          if (minPrice) products = products.filter((p: any) => typeof p.price === 'number' && p.price >= Number(minPrice));
          if (maxPrice) products = products.filter((p: any) => typeof p.price === 'number' && p.price <= Number(maxPrice));
          if (minRating) products = products.filter((p: any) => (p.ratingCard?.average || 0) >= Number(minRating));
        }
        if (!products || products.length === 0) {
          // Broader scan (limited) with substring match
          const candidates = await getRecommendedProducts(200);
          const nq = q.toLowerCase();
          let filtered = candidates.filter((p: any) => ((p.name || '') + ' ' + (p.description || '')).toLowerCase().includes(nq));
          if (mainCategorySlug) filtered = filtered.filter((p: any) => p.mainCategorySlug === mainCategorySlug);
          if (subCategorySlug) filtered = filtered.filter((p: any) => p.subCategorySlug === subCategorySlug);
          if (subSubCategorySlug) filtered = filtered.filter((p: any) => p.subSubCategorySlug === subSubCategorySlug);
          if (minPrice) filtered = filtered.filter((p: any) => typeof p.price === 'number' && p.price >= Number(minPrice));
          if (maxPrice) filtered = filtered.filter((p: any) => typeof p.price === 'number' && p.price <= Number(maxPrice));
          if (minRating) filtered = filtered.filter((p: any) => (p.ratingCard?.average || 0) >= Number(minRating));
          products = filtered.slice(0, limit);
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
          // Apply optional filters for fallback path
          let filtered = candidates.filter((d: any) => ((d.title || '') + ' ' + (d.description || '')).toLowerCase().includes(nq));
          if (mainCategorySlug) filtered = filtered.filter((d: any) => d.mainCategorySlug === mainCategorySlug);
          if (subCategorySlug) filtered = filtered.filter((d: any) => d.subCategorySlug === subCategorySlug);
            if (subSubCategorySlug) filtered = filtered.filter((d: any) => d.subSubCategorySlug === subSubCategorySlug);
          if (minPrice) filtered = filtered.filter((d: any) => typeof d.price === 'number' && d.price >= Number(minPrice));
          if (maxPrice) filtered = filtered.filter((d: any) => typeof d.price === 'number' && d.price <= Number(maxPrice));
          if (minTemperature) filtered = filtered.filter((d: any) => typeof d.temperature === 'number' && d.temperature >= Number(minTemperature));

          // Sort fallback
          if (sort) {
            filtered.sort((a: any, b: any) => {
              switch (sort) {
                case 'temperature': return (b.temperature||0) - (a.temperature||0);
                case 'price_asc': return (a.price||0) - (b.price||0);
                case 'price_desc': return (b.price||0) - (a.price||0);
                case 'newest': {
                  const ta = a.postedAt?.seconds ? a.postedAt.seconds*1000 : Date.parse(a.postedAt||0);
                  const tb = b.postedAt?.seconds ? b.postedAt.seconds*1000 : Date.parse(b.postedAt||0);
                  return (tb||0) - (ta||0);
                }
                default: return 0;
              }
            });
          }
          deals = filtered.slice(0, limit);
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
      const productFilters: string[] = [];
      if (mainCategorySlug) productFilters.push(`mainCategorySlug:=${mainCategorySlug}`);
      if (subCategorySlug) productFilters.push(`subCategorySlug:=${subCategorySlug}`);
      if (subSubCategorySlug) productFilters.push(`subSubCategorySlug:=${subSubCategorySlug}`);
      if (minPrice) productFilters.push(`price:>=${Number(minPrice)}`);
      if (maxPrice) productFilters.push(`price:<=${Number(maxPrice)}`);
      if (minRating) productFilters.push(`ratingCard.average:>=${Number(minRating)}`);

      tasks.push(typesenseServerClient.collections('products').documents().search({ 
        q, 
        query_by: 'name,description', 
        per_page: limit,
        filter_by: productFilters.join(' && '),
      }, {}));
    } else {
      tasks.push(Promise.resolve({ hits: [] }));
    }
    if (type === 'deals' || type === 'all') {
      // Build filters
      const filters: string[] = [];
      if (mainCategorySlug) filters.push(`mainCategorySlug:=${mainCategorySlug}`);
      if (subCategorySlug) filters.push(`subCategorySlug:=${subCategorySlug}`);
      if (subSubCategorySlug) filters.push(`subSubCategorySlug:=${subSubCategorySlug}`);
      if (minPrice) filters.push(`price:>=${Number(minPrice)}`);
      if (maxPrice) filters.push(`price:<=${Number(maxPrice)}`);
      if (minTemperature) filters.push(`temperature:>=${Number(minTemperature)}`);
      filters.push(`status:=approved`);

      // Sorting
      let sort_by = '';
      switch (sort) {
        case 'temperature': sort_by = 'temperature:desc'; break;
        case 'price_asc': sort_by = 'price:asc'; break;
        case 'price_desc': sort_by = 'price:desc'; break;
        case 'newest': sort_by = 'postedAt:desc'; break;
        default: sort_by = '_text_match:desc';
      }

      tasks.push(typesenseServerClient.collections('deals').documents().search({ 
        q, 
        query_by: 'title,description', 
        per_page: limit,
        filter_by: filters.join(' && '),
        sort_by
      }, {}));
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
