import { NextResponse } from 'next/server';
import { buildSignedParams, toQueryString } from '@/lib/aliexpress';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || url.searchParams.get('itemId') || '';

  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const API_BASE = process.env.ALIEXPRESS_API_BASE;
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY || process.env.ALIEXPRESS_API_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
  const AFFILIATE_ID = process.env.ALIEXPRESS_AFFILIATE_ID;

  if (!API_BASE) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  try {
    // Primary method for details
    const primaryMethod = 'aliexpress.affiliate.product.detail';
    const secondaryMethod = 'aliexpress.affiliate.product.get';

    const baseParams: Record<string, string | number | boolean> = {
      method: primaryMethod,
      item_id: id,
      target_language: 'EN',
      ship_to_country: 'PL',
      sign_method: 'md5',
    };
    if (AFFILIATE_ID) baseParams['tracking_id'] = AFFILIATE_ID;

    const signed = buildSignedParams(baseParams, String(APP_KEY), String(APP_SECRET));
    const body = toQueryString(signed);

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
      next: { revalidate: 60 },
    });

    let text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}

    if (!data || (!res.ok)) {
      // Try fallback method
      const fbParams = { ...baseParams, method: secondaryMethod };
      const fbSigned = buildSignedParams(fbParams, String(APP_KEY), String(APP_SECRET));
      const fbBody = toQueryString(fbSigned);
      const fbRes = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: fbBody,
      });
      text = await fbRes.text();
      try { data = JSON.parse(text); } catch {}
      if (!data) {
        return NextResponse.json({ error: 'invalid_response', details: text.slice(0, 500) }, { status: 502 });
      }
    }

    // Extract detail from multiple possible wrappers
    const wrap = data.aliexpress_affiliate_product_detail_response
      || data.aliexpress_affiliate_product_get_response
      || data.aliexpress_affiliate_productdetail_response
      || data.aliexpress_affiliate_productget_response
      || data.product_detail_response
      || data;

    const product = wrap?.result?.product || wrap?.product || wrap?.data || wrap?.result || wrap?.item;

    if (!product) {
      return NextResponse.json({ raw: data });
    }

    // Normalize a few common fields
    const normalized = {
      id: String(product.product_id || product.item_id || id),
      title: product.product_title || product.title || '',
      descriptionHtml: product.description || product.detail || product.description_html || '',
      images: product.product_images || product.images || product.image_urls || product.product_small_image_urls?.string || [],
      mainImage: product.product_main_image_url || product.image_url || '',
      price: Number(product.target_sale_price || product.sale_price || product.app_sale_price || 0),
      originalPrice: Number(product.target_original_price || product.original_price || 0),
      rating: product.evaluate_rate ? parseFloat(product.evaluate_rate) / 20 : (product.product_rating ? Number(product.product_rating) : 0),
      orders: product.lastest_volume || product.volume || product.orders || 0,
      merchant: product.store_name || product.seller_name || '',
      shipping: product.shipping || product.logistics_info || '',
      attributes: product.attributes || product.specs || [],
    };

    return NextResponse.json({ product: normalized, raw: data });
  } catch (e) {
    console.error('AliExpress item proxy failed:', e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
