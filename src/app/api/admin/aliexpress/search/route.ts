import { NextResponse } from 'next/server';
import { buildSignedParams, toQueryString } from '@/lib/aliexpress';
import { expandQueryWithSynonyms, rankProductsByRelevance } from '@/lib/search-helpers';
import { requireModerator } from '@/lib/auth-server';

// Official AliExpress Affiliate API integration
// Uses aliexpress.affiliate.productquery method

export async function GET(request: Request) {
  try {
    await requireModerator();
  } catch (authError: any) {
    const isForbidden = authError.message?.includes('Forbidden');
    return NextResponse.json(
      { error: authError.message || 'Unauthorized' },
      { status: isForbidden ? 403 : 401 }
    );
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const category = url.searchParams.get('category') || '';
  const minPrice = url.searchParams.get('minPrice') || '';
  const maxPrice = url.searchParams.get('maxPrice') || '';
  const minRating = url.searchParams.get('minRating') || '';
  const minOrders = url.searchParams.get('minOrders') || '';
  const minDiscount = url.searchParams.get('minDiscount') || '';
  const limit = Number(url.searchParams.get('limit') || '50');
  const page = Number(url.searchParams.get('page') || '1');

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ 
      products: [], 
      message: 'Query must be at least 2 characters' 
    });
  }

  // Server-side configuration (from Secret Manager on production)
  const API_BASE = process.env.ALIEXPRESS_API_ENDPOINT || process.env.ALIEXPRESS_API_BASE;
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
    // Expand query with synonyms for better results
    const synonyms = expandQueryWithSynonyms(q);
    const expandedQuery = synonyms.slice(0, 3).join(' '); // Use top 3 terms max
    
    console.log('[AliExpress] Query expansion:', {
      original: q,
      synonyms,
      expanded: expandedQuery,
    });
    
    // Build AliExpress Affiliate API parameters
    // Method: aliexpress.affiliate.productquery
    // https://developers.aliexpress.com/en/doc.htm?docId=45801&docType=2
    const primaryMethod = 'aliexpress.affiliate.product.query';
    const secondaryMethod = 'aliexpress.affiliate.product.search';
    const apiParams: Record<string, string | number> = {
      method: primaryMethod,
      keywords: expandedQuery, // Use expanded query with synonyms
      page_size: Math.min(limit, 50), // Max 50 per AliExpress API
      page_no: page,
      target_language: 'EN',
      target_currency: 'PLN', // ← Pobieraj ceny w PLN
      ship_to_country: 'PL',
    };

    if (category) apiParams.category_ids = category;
    if (minPrice) apiParams.min_sale_price = minPrice;
    if (maxPrice) apiParams.max_sale_price = maxPrice;
    if (AFFILIATE_ID) apiParams.tracking_id = AFFILIATE_ID;
    
    // Optional filters from spec
    if (minRating) apiParams.ship_to_country = 'PL'; // For rating filter, need country context
    if (minOrders) apiParams.min_lastest_volume = minOrders;
    // AliExpress API nie respektuje bezpośrednio minDiscount – filtr lokalny niżej

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

    // Advanced fallback: Hot Products (if enabled and still 0 results)
    const enableAdvanced = process.env.ALIEXPRESS_ENABLE_ADVANCED === '1' || process.env.ALIEXPRESS_ENABLE_ADVANCED === 'true';
    if (products.length === 0 && enableAdvanced) {
      console.warn('[AliExpress] Both primary/secondary returned 0. Attempting Hot Products API...');
      const hotMethod = 'aliexpress.affiliate.hotproduct.query';
      const hotParams: Record<string, string | number> = {
        method: hotMethod,
        target_language: 'EN',
        target_currency: 'PLN', // ← Pobieraj w PLN
        ship_to_country: 'PL',
        page_size: Math.min(limit, 50),
        page_no: page,
      };
      if (category) hotParams.category_ids = category;
      if (AFFILIATE_ID) hotParams.tracking_id = AFFILIATE_ID;
      
      const hotSigned = buildSignedParams({ ...hotParams, sign_method: 'md5' }, String(APP_KEY), String(APP_SECRET));
      const hotBody = toQueryString(hotSigned);
      const hotRes = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: hotBody,
      });
      
      console.log('[AliExpress] Hot Products response status:', hotRes.status);
      if (hotRes.ok) {
        const hotText = await hotRes.text();
        let hotJson: any = null;
        try { hotJson = JSON.parse(hotText); } catch {}
        if (hotJson) {
          const hotWrapper = hotJson.aliexpress_affiliate_hotproduct_query_response || hotJson.aliexpress_affiliate_hotproductquery_response;
          const hotExtraction = extractProducts(hotWrapper);
          if (hotExtraction.rawProducts && hotExtraction.rawProducts.length) {
            total = hotExtraction.total;
            products = hotExtraction.rawProducts;
            console.log(`[AliExpress] Hot Products fallback succeeded with ${products.length} products.`);
          } else {
            console.warn('[AliExpress] Hot Products returned 0. Snippet:', hotText.slice(0, 300));
          }
        }
      }
    }

    // Normalize & filter
    console.log(`[AliExpress] Raw products from API: ${products.length}`);
    
    products = products.map((p: any) => {
      // Extract images array from various possible fields
      const images: string[] = [];
      
      // Main image first
      const mainImage = p.product_main_image_url || p.image_url || p.product_image || p.item_main_image || '';
      if (mainImage) images.push(mainImage);
      
      // Additional images from various fields
      if (p.product_small_image_urls?.string) {
        const additionalImages = Array.isArray(p.product_small_image_urls.string) 
          ? p.product_small_image_urls.string 
          : [p.product_small_image_urls.string];
        images.push(...additionalImages.filter((url: string) => url && !images.includes(url)));
      }
      
      // Additional image sources
      if (p.product_images) {
        const moreImages = Array.isArray(p.product_images) ? p.product_images : [p.product_images];
        images.push(...moreImages.filter((url: string) => url && !images.includes(url)));
      }
      
      // Extract warehouse/shipping information
      const warehouse = p.ship_from_country || p.warehouse_location || p.ship_from || '';
      const deliveryTime = p.delivery_time || p.estimated_delivery_time || p.logistics_info?.delivery_time || '';
      
      // Extract shipping details
      const shippingInfo = {
        warehouse: warehouse,
        deliveryTime: deliveryTime,
        freeShipping: p.free_shipping || p.is_free_shipping || false,
        shippingCost: p.shipping_cost || p.shipping_price || null,
        shippingMethod: p.shipping_method || null,
      };
      
      return {
        id: String(p.product_id || p.productId || p.item_id || p.itemId || ''),
        title: p.product_title || p.title || p.item_title || '',
        description: p.product_description || p.description || p.short_description || '',
        price: Number(p.target_sale_price || p.sale_price || p.sale_price_amount || p.target_app_sale_price || 0),
        originalPrice: Number(p.target_original_price || p.original_price || p.original_price_amount || null),
        imageUrl: mainImage,
        images: images, // Wszystkie zdjęcia bez limitu
        productUrl: p.promotion_link || p.product_detail_url || p.target_url || '',
        rating: p.evaluate_rate ? parseFloat(p.evaluate_rate) / 20 : (p.product_rating ? Number(p.product_rating) : 0),
        orders: p.lastest_volume || p.volume || p.orders || p.trade_volume || 0,
        discount: p.discount ? parseInt(p.discount) : 0,
        shipping: p.first_level_category_name || p.category_name || '',
        shippingInfo: shippingInfo,
        currency: p.target_sale_price_currency || 'PLN', // ← API zwraca walutę
        merchant: p.shop_title || p.shop_name || '',
        merchantId: p.shop_id || null,
        categoryId: p.first_level_category_id || p.category_id || '',
        categoryName: p.first_level_category_name || p.category_name || '',
        // Dodatkowe metadane
        productVideoUrl: p.product_video_url || null,
        specifications: p.specifications || p.attributes || null,
      };
    });

    console.log(`[AliExpress] After normalization: ${products.length} products`);

    // Basic quality filters
    products = products.filter((p: any) => 
      p.title && p.title.length >= 6 &&
      p.imageUrl &&
      p.price > 0 &&
      p.orders >= 0 && // relax orders for initial import visibility
      !p.title.match(/fake|replica|scam|pirate/i)
    );

    console.log(`[AliExpress] After quality filters: ${products.length} products`);

    // CLIENT-SIDE PRICE FILTERING (since AliExpress API ignores min/max price params)
    const minPriceNum = minPrice ? parseFloat(minPrice) : null;
    const maxPriceNum = maxPrice ? parseFloat(maxPrice) : null;
    
    if (minPriceNum !== null || maxPriceNum !== null) {
      const beforePriceFilter = products.length;
      products = products.filter((p: any) => {
        if (minPriceNum !== null && p.price < minPriceNum) return false;
        if (maxPriceNum !== null && p.price > maxPriceNum) return false;
        return true;
      });
      console.log(`[AliExpress] Price filter applied (${minPriceNum || 0}-${maxPriceNum || '∞'}): ${beforePriceFilter} → ${products.length} products`);
    }

    // CLIENT-SIDE RATING FILTERING
    const minRatingNum = minRating ? parseFloat(minRating) : null;
    if (minRatingNum !== null) {
      const beforeRatingFilter = products.length;
      products = products.filter((p: any) => p.rating >= minRatingNum);
      console.log(`[AliExpress] Rating filter applied (>=${minRatingNum}): ${beforeRatingFilter} → ${products.length} products`);
    }

    // CLIENT-SIDE ORDERS FILTERING
    const minOrdersNum = minOrders ? parseInt(minOrders) : null;
    if (minOrdersNum !== null) {
      const beforeOrdersFilter = products.length;
      products = products.filter((p: any) => p.orders >= minOrdersNum);
      console.log(`[AliExpress] Orders filter applied (>=${minOrdersNum}): ${beforeOrdersFilter} → ${products.length} products`);
    }

    // CLIENT-SIDE DISCOUNT FILTERING (używa p.discount lub wyliczenia fallback)
    const minDiscountNum = minDiscount ? parseInt(minDiscount) : null;
    if (minDiscountNum !== null) {
      const beforeDiscountFilter = products.length;
      products = products.filter((p: any) => {
        const apiDiscount = typeof p.discount === 'string' ? parseInt(p.discount) : p.discount;
        let computedDiscount = 0;
        if (p.originalPrice && p.price && p.originalPrice > 0) {
          computedDiscount = Math.round((1 - p.price / p.originalPrice) * 100);
        }
        const effectiveDiscount = apiDiscount || computedDiscount || 0;
        return effectiveDiscount >= minDiscountNum;
      });
      console.log(`[AliExpress] Discount filter applied (>=${minDiscountNum}%): ${beforeDiscountFilter} → ${products.length} products`);
    }

    console.log(`[AliExpress] Final products after all filters: ${products.length}/${total}`);

    // RANK BY RELEVANCE using fuzzy matching
    const rankedProducts = rankProductsByRelevance(products, q);
    console.log('[AliExpress] Ranked by relevance. Top 3 scores:', 
      rankedProducts.slice(0, 3).map(p => ({ 
        title: p.title.slice(0, 50), 
        score: p.relevanceScore.toFixed(2) 
      }))
    );

    return NextResponse.json({ 
      products: rankedProducts,
      total,
      page,
      pageSize: apiParams.page_size,
      query: {
        original: q,
        expanded: expandedQuery,
        synonyms,
      },
    });
  } catch (e) {
    console.error('[AliExpress] Request failed:', e);
    return NextResponse.json({ 
      error: 'proxy_failed', 
      message: String(e) 
    }, { status: 500 });
  }
}

/**
 * POST handler for AI flows that send JSON body instead of query params
 * Converts body to query string and reuses GET logic
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, limit, sort, category, minPrice, maxPrice, minRating, minOrders, minDiscount, page } = body;
    
    // Build query string from body params
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (limit) params.set('limit', String(limit));
    if (category) params.set('category', category);
    if (minPrice) params.set('minPrice', String(minPrice));
    if (maxPrice) params.set('maxPrice', String(maxPrice));
    if (minRating) params.set('minRating', String(minRating));
    if (minOrders) params.set('minOrders', String(minOrders));
    if (minDiscount) params.set('minDiscount', String(minDiscount));
    if (page) params.set('page', String(page));
    
    // Create a new request with query params
    const url = new URL(request.url);
    url.search = params.toString();
    
    const newRequest = new Request(url.toString(), {
      method: 'GET',
      headers: request.headers,
    });
    
    // Reuse GET handler
    return await GET(newRequest);
  } catch (e) {
    console.error('[AliExpress POST] Invalid request:', e);
    return NextResponse.json({ 
      error: 'invalid_request', 
      message: 'Invalid JSON body' 
    }, { status: 400 });
  }
}
