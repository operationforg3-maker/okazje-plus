"use client";
import { useEffect, useState } from 'react';

interface Coupon {
  coupon_id?: string;
  coupon_code?: string;
  coupon_amount?: string;
  coupon_start_time?: string;
  coupon_end_time?: string;
  coupon_link?: string;
  [key: string]: any;
}

export function useCoupons(productId?: string, shopId?: string) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchCoupons() {
      if (!productId && !shopId) return;
      setLoading(true);
      setError(null);
      try {
        const base = `${process.env.NEXT_PUBLIC_SITE_URL || ''}`;
        const url = `${base}/api/admin/aliexpress/advanced/coupons?${new URLSearchParams({ ...(productId ? { productId } : {}), ...(shopId ? { shopId } : {}) }).toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Nieznany błąd');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCoupons();
    return () => { cancelled = true; };
  }, [productId, shopId]);

  return { coupons, loading, error };
}
