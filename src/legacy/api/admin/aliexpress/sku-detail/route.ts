import { NextResponse } from 'next/server';
import { buildSignedParams, toQueryString } from '@/lib/aliexpress';

/**
 * SKU Dimension API endpoint
 * Fetches detailed product information including variants (colors, sizes) and pricing
 * Requires Advanced API access
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('id');
  const targetLanguage = url.searchParams.get('lang') || 'EN';
  const targetCurrency = url.searchParams.get('currency') || 'USD';

  if (!productId) {
    return NextResponse.json({ 
      error: 'missing_product_id', 
      message: 'Product ID is required' 
    }, { status: 400 });
  }

  const API_BASE = process.env.ALIEXPRESS_API_BASE;
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
  const AFFILIATE_ID = process.env.ALIEXPRESS_AFFILIATE_ID;

  if (!API_BASE || !APP_KEY || !APP_SECRET) {
    console.warn('[AliExpress SKU] API not configured');
    return NextResponse.json({ 
      error: 'not_configured', 
      message: 'AliExpress API credentials not configured' 
    }, { status: 503 });
  }

  const enableAdvanced = process.env.ALIEXPRESS_ENABLE_ADVANCED === '1' || process.env.ALIEXPRESS_ENABLE_ADVANCED === 'true';
  if (!enableAdvanced) {
    return NextResponse.json({
      error: 'advanced_disabled',
      message: 'Advanced API features not enabled. Set ALIEXPRESS_ENABLE_ADVANCED=1'
    }, { status: 403 });
  }

  try {
    // SKU Dimension API method
    const method = 'aliexpress.affiliate.product.detail';
    const apiParams: Record<string, string | number> = {
      method,
      product_ids: productId,
      target_language: targetLanguage,
      target_currency: targetCurrency,
      ship_to_country: 'PL',
    };

    if (AFFILIATE_ID) apiParams.tracking_id = AFFILIATE_ID;

    const signed = buildSignedParams({ ...apiParams, sign_method: 'md5' }, String(APP_KEY), String(APP_SECRET));
    const body = toQueryString(signed);

    console.log('[AliExpress SKU] Fetching details for product:', productId);

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body,
      next: { revalidate: 600 }, // Cache 10 minutes
    });

    console.log('[AliExpress SKU] Response status:', res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error('[AliExpress SKU] API error:', res.status, text.slice(0, 500));
      return NextResponse.json({ 
        error: 'upstream_error', 
        status: res.status, 
        message: `AliExpress API returned ${res.status}` 
      }, { status: 502 });
    }

    const responseText = await res.text();
    console.log('[AliExpress SKU] Response (first 500 chars):', responseText.slice(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[AliExpress SKU] JSON parse error:', parseError);
      return NextResponse.json({
        error: 'invalid_response',
        message: 'AliExpress returned non-JSON response'
      }, { status: 502 });
    }

    // Parse response structure
    const responseWrapper = (data as any).aliexpress_affiliate_product_detail_response || 
                           (data as any).aliexpress_affiliate_productdetail_response;
    
    if (!responseWrapper) {
      console.warn('[AliExpress SKU] Unexpected response structure:', Object.keys(data));
      return NextResponse.json({
        error: 'unexpected_structure',
        message: 'Could not parse AliExpress response',
        details: Object.keys(data)
      }, { status: 502 });
    }

    const respResult = responseWrapper.resp_result?.result || responseWrapper.result;
    const products = respResult?.products?.product || respResult?.products || [];
    
    if (!products || products.length === 0) {
      return NextResponse.json({
        error: 'not_found',
        message: `Product ${productId} not found`
      }, { status: 404 });
    }

    const product = Array.isArray(products) ? products[0] : products;

    // Normalize SKU details
    const normalized = {
      id: String(product.product_id || productId),
      title: product.product_title || product.title || '',
      description: product.product_description || product.description || '',
      price: {
        current: Number(product.target_sale_price || product.sale_price || 0),
        original: Number(product.target_original_price || product.original_price || null),
        currency: targetCurrency,
      },
      images: {
        main: product.product_main_image_url || product.image_url || '',
        gallery: product.product_small_image_urls?.string || product.product_images || [],
      },
      rating: {
        score: product.evaluate_rate ? parseFloat(product.evaluate_rate) / 20 : (product.product_rating ? Number(product.product_rating) : 0),
        count: product.evaluation_count || 0,
      },
      orders: product.lastest_volume || product.volume || product.orders || 0,
      shipping: {
        warehouse: product.ship_from_country || product.warehouse_location || '',
        deliveryTime: product.delivery_time || product.estimated_delivery_time || '',
        freeShipping: product.free_shipping || product.is_free_shipping || false,
        cost: product.shipping_cost || product.shipping_price || null,
      },
      merchant: {
        name: product.shop_title || product.shop_name || '',
        id: product.shop_id || null,
      },
      category: {
        id: product.first_level_category_id || product.category_id || '',
        name: product.first_level_category_name || product.category_name || '',
      },
      urls: {
        product: product.product_detail_url || product.target_url || '',
        affiliate: product.promotion_link || product.product_detail_url || '',
        video: product.product_video_url || null,
      },
      variants: product.aeop_ae_product_skus?.aeop_ae_product_sku || product.skus || [],
      specifications: product.specifications || product.attributes || null,
    };

    return NextResponse.json({ 
      product: normalized,
      source: 'sku_dimension_api'
    });
  } catch (e) {
    console.error('[AliExpress SKU] Request failed:', e);
    return NextResponse.json({ 
      error: 'proxy_failed', 
      message: String(e) 
    }, { status: 500 });
  }
}
