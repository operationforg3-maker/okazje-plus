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
    const apiParams: Record<string, string | number> = {
      method: 'aliexpress.affiliate.productquery',
      keywords: q,
      page_size: Math.min(limit, 50), // Max 50 per AliExpress API
      page_no: page,
    };

    if (category) apiParams.category_ids = category;
    if (minPrice) apiParams.min_sale_price = minPrice;
    if (maxPrice) apiParams.max_sale_price = maxPrice;
    if (AFFILIATE_ID) apiParams.tracking_id = AFFILIATE_ID;
    
    // Optional filters from spec
    if (minRating) apiParams.ship_to_country = 'PL'; // For rating filter, need country context
    if (minOrders) apiParams.min_lastest_volume = minOrders;

    // Build signed params (app_key, timestamp, sign, format, v)
    const signed = buildSignedParams(apiParams, String(APP_KEY), String(APP_SECRET));
    
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
    
    const responseWrapper = data.aliexpress_affiliate_productquery_response;
    if (responseWrapper?.resp_result?.result) {
      const result = responseWrapper.resp_result.result;
      const rawProducts = result.products?.product || [];
      
      total = result.total_record_count || rawProducts.length;
      
      // Map AliExpress fields to our format (as per spec)
      products = rawProducts.map((p: any) => ({
        id: String(p.product_id || p.productId),
        title: p.product_title || p.title || '',
        price: Number(p.target_sale_price || p.sale_price || 0),
        originalPrice: Number(p.target_original_price || p.original_price || null),
        imageUrl: p.product_main_image_url || p.image_url || '',
        productUrl: p.promotion_link || p.product_detail_url || '',
        rating: p.evaluate_rate ? parseFloat(p.evaluate_rate) / 20 : 0, // Convert to 0-5 scale
        orders: p.lastest_volume || p.volume || 0,
        discount: p.discount ? parseInt(p.discount) : 0,
        shipping: p.first_level_category_name || '',
        currency: 'USD', // AliExpress typically returns USD
      })).filter((p: any) => 
        // Filter per spec requirements
        p.title.length >= 10 &&
        p.imageUrl &&
        p.price > 0 &&
        p.rating >= 3.5 &&
        p.orders >= 10 &&
        !p.title.match(/fake|replica|scam/i)
      );
      
      console.log(`[AliExpress] Fetched ${products.length}/${total} products (filtered)`);
    } else {
      console.warn('[AliExpress] Unexpected response structure:', JSON.stringify(data).slice(0, 500));
      
      // Check for error in response
      if (data.error_response) {
        return NextResponse.json({
          error: 'api_error',
          message: data.error_response.msg || 'AliExpress API error',
          code: data.error_response.code,
        }, { status: 400 });
      }
    }

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

