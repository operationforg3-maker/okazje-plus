import { NextResponse } from 'next/server';
import { buildSignedParams, toQueryString } from '@/lib/aliexpress';

// Official AliExpress Affiliate API integration
// Uses aliexpress.affiliate.productquery method

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category') || '';
  const minPrice = url.searchParams.get('minPrice') || '';
  const maxPrice = url.searchParams.get('maxPrice') || '';
  const minRating = url.searchParams.get('minRating') || '';
  const minOrders = url.searchParams.get('minOrders') || '';
  const limit = Number(url.searchParams.get('limit') || '50');
  const page = Number(url.searchParams.get('page') || '1');

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ 
      products: [], 
      message: 'Query must be at least 2 characters' 
    });
  }

  // Server-side configuration (from Secret Manager on production)
  const API_BASE = process.env.ALIEXPRESS_API_BASE;
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
  const AFFILIATE_ID = process.env.ALIEXPRESS_AFFILIATE_ID;

  // Validation: prevent accidental exposure
  if (!API_BASE || !APP_KEY || !APP_SECRET) {
    console.warn('[AliExpress] API not configured - credentials missing');
    return NextResponse.json({ 
      error: 'not_configured', 
      message: 'AliExpress API credentials not configured. Contact administrator.' 
    }, { status: 503 });
  }

  try {
    // Build AliExpress Affiliate API parameters
    // Method: aliexpress.affiliate.productquery
    // https://developers.aliexpress.com/en/doc.htm?docId=45801&docType=2
    const primaryMethod = 'aliexpress.affiliate.product.query';
    const secondaryMethod = 'aliexpress.affiliate.product.search';
    const apiParams: Record<string, string | number> = {
      method: primaryMethod,
      keywords: q,
      page_size: Math.min(limit, 50), // Max 50 per AliExpress API
      page_no: page,
      target_language: 'EN',
      ship_to_country: 'PL',
    };

    if (category) apiParams.category_ids = category;
    if (minPrice) apiParams.min_sale_price = minPrice;
    if (maxPrice) apiParams.max_sale_price = maxPrice;
    if (AFFILIATE_ID) apiParams.tracking_id = AFFILIATE_ID;
    
    // Optional filters from spec
    if (minRating) apiParams.ship_to_country = 'PL'; // For rating filter, need country context
    if (minOrders) apiParams.min_lastest_volume = minOrders;

    // Build signed params (app_key, timestamp, sign, format, v)
  const signed = buildSignedParams({ ...apiParams, sign_method: 'md5' }, String(APP_KEY), String(APP_SECRET));
    
    // AliExpress Open Platform requires POST with form-urlencoded
    const body = toQueryString(signed);
    
    console.log('[AliExpress] Calling API:', {
      endpoint: API_BASE,
      method: apiParams.method,
      keywords: q,
      page: page,
      limit: apiParams.page_size,
      app_key: APP_KEY,
      timestamp: signed.timestamp,
      sign: signed.sign?.slice(0, 10) + '...',
    });
    
    console.log('[AliExpress] Request body (first 200 chars):', body.slice(0, 200));
    
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body,
      next: { revalidate: 300 }, // Cache 5 minutes
    });

    console.log('[AliExpress] Response status:', res.status, res.statusText);

    if (!res.ok) {
      const text = await res.text();
      console.error('[AliExpress] API error:', { 
        status: res.status, 
        statusText: res.statusText,
        body: text.slice(0, 500),
        headers: Object.fromEntries(res.headers.entries()),
      });
      return NextResponse.json({ 
        error: 'upstream_error', 
        status: res.status, 
        message: `AliExpress API returned ${res.status}`,
        details: text.slice(0, 500),
      }, { status: 502 });
    }

    const responseText = await res.text();
    console.log('[AliExpress] Response body (first 500 chars):', responseText.slice(0, 500));
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[AliExpress] JSON parse error:', parseError);
      console.error('[AliExpress] Response was:', responseText.slice(0, 1000));
      return NextResponse.json({
        error: 'invalid_response',
        message: 'AliExpress returned non-JSON response',
        details: responseText.slice(0, 500),
      }, { status: 502 });
    }
    
    // Parse AliExpress response structure
    // Response format: { aliexpress_affiliate_productquery_response: { resp_result: { result: { products: { product: [...] } } } } }
    let products: any[] = [];
    let total = 0;
    
    function extractProducts(wrapper: any) {
      if (!wrapper) return { products: [], total: 0 };
      const respResult = wrapper.resp_result?.result || wrapper.result;
      if (!respResult) return { products: [], total: 0 };
      const rawProducts = respResult.products?.product || respResult.products || [];
      const total = respResult.total_record_count || rawProducts.length || 0;
      return { rawProducts, total };
    }

    let responseWrapper = (data as any).aliexpress_affiliate_productquery_response || (data as any).aliexpress_affiliate_product_query_response;
    const firstExtraction = extractProducts(responseWrapper);
    if (firstExtraction.rawProducts && firstExtraction.rawProducts.length) {
      total = firstExtraction.total;
      products = firstExtraction.rawProducts;
    }

    // Fallback: try secondary method if no products
    if (products.length === 0) {
      console.warn('[AliExpress] Primary method returned 0 products. Attempting fallback method:', secondaryMethod);
      const fallbackParams = { ...apiParams, method: secondaryMethod };
      const fallbackSigned = buildSignedParams({ ...fallbackParams, sign_method: 'md5' }, String(APP_KEY), String(APP_SECRET));
      const fallbackBody = toQueryString(fallbackSigned);
      const fallbackRes = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: fallbackBody,
      });
      console.log('[AliExpress] Fallback response status:', fallbackRes.status, fallbackRes.statusText);
      const fallbackText = await fallbackRes.text();
      let fallbackJson: any = null;
      try { fallbackJson = JSON.parse(fallbackText); } catch {}
      if (fallbackJson) {
        responseWrapper = fallbackJson.aliexpress_affiliate_product_search_response || fallbackJson.aliexpress_affiliate_productsearch_response;
        const secondExtraction = extractProducts(responseWrapper);
        if (secondExtraction.rawProducts && secondExtraction.rawProducts.length) {
          total = secondExtraction.total;
          products = secondExtraction.rawProducts;
          console.log(`[AliExpress] Fallback succeeded with ${products.length} products.`);
        } else {
          console.warn('[AliExpress] Fallback also returned 0 products. Raw snippet:', fallbackText.slice(0, 300));
        }
      } else {
        console.warn('[AliExpress] Fallback non-JSON response:', fallbackText.slice(0, 300));
      }
    }

    // Normalize & filter
    products = products.map((p: any) => ({
      id: String(p.product_id || p.productId || p.item_id || p.itemId || ''),
      title: p.product_title || p.title || p.item_title || '',
      price: Number(p.target_sale_price || p.sale_price || p.sale_price_amount || p.target_app_sale_price || 0),
      originalPrice: Number(p.target_original_price || p.original_price || p.original_price_amount || null),
      imageUrl: p.product_main_image_url || p.image_url || p.product_image || p.item_main_image || '',
      productUrl: p.promotion_link || p.product_detail_url || p.target_url || '',
      rating: p.evaluate_rate ? parseFloat(p.evaluate_rate) / 20 : (p.product_rating ? Number(p.product_rating) : 0),
      orders: p.lastest_volume || p.volume || p.orders || p.trade_volume || 0,
      discount: p.discount ? parseInt(p.discount) : 0,
      shipping: p.first_level_category_name || p.category_name || '',
      currency: 'USD',
    })).filter((p: any) => 
      p.title && p.title.length >= 6 &&
      p.imageUrl &&
      p.price > 0 &&
      p.orders >= 0 && // relax orders for initial import visibility
      !p.title.match(/fake|replica|scam|pirate/i)
    );

    console.log(`[AliExpress] Final normalized products count: ${products.length}/${total}`);

    return NextResponse.json({ 
      products,
      total,
      page,
      pageSize: apiParams.page_size,
    });
  } catch (e) {
    console.error('[AliExpress] Request failed:', e);
    return NextResponse.json({ 
      error: 'proxy_failed', 
      message: String(e) 
    }, { status: 500 });
  }
}

