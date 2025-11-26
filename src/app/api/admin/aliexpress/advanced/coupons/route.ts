import { NextResponse } from 'next/server';
import { buildSignedParams, toQueryString } from '@/lib/aliexpress';

/**
 * Advanced: Coupons lookup for product or shop
 * Wymaga ALIEXPRESS_ENABLE_ADVANCED=1 i poprawnych kredencjaliów.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('productId') || '';
  const shopId = url.searchParams.get('shopId') || '';

  const API_BASE = process.env.ALIEXPRESS_API_BASE;
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
  const AFFILIATE_ID = process.env.ALIEXPRESS_AFFILIATE_ID;

  if (!API_BASE || !APP_KEY || !APP_SECRET) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }
  const enableAdvanced = process.env.ALIEXPRESS_ENABLE_ADVANCED === '1' || process.env.ALIEXPRESS_ENABLE_ADVANCED === 'true';
  if (!enableAdvanced) {
    return NextResponse.json({ error: 'advanced_disabled' }, { status: 403 });
  }

  try {
    // Metoda kuponów może różnić się w dokumentacji; używamy ogólnego schematu
    const method = 'aliexpress.affiliate.coupon.get';
    const params: Record<string, string | number> = {
      method,
      target_language: 'EN',
      ship_to_country: 'PL',
    };
    if (productId) params.product_id = productId;
    if (shopId) params.shop_id = shopId;
    if (AFFILIATE_ID) params.tracking_id = AFFILIATE_ID;

    const signed = buildSignedParams({ ...params, sign_method: 'md5' }, String(APP_KEY), String(APP_SECRET));
    const body = toQueryString(signed);

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'upstream_error', status: res.status }, { status: 502 });
    }
    const txt = await res.text();
    let data: any = null;
    try { data = JSON.parse(txt); } catch {}
    const wrapper = data?.aliexpress_affiliate_coupon_get_response || data?.aliexpress_affiliate_couponget_response || data;
    const result = wrapper?.resp_result?.result || wrapper?.result || wrapper;
    const coupons = result?.coupons || result?.coupon_list || [];
    return NextResponse.json({ coupons });
  } catch (e) {
    console.error('[Advanced Coupons] Failed:', e);
    return NextResponse.json({ error: 'failed', message: String(e) }, { status: 500 });
  }
}
