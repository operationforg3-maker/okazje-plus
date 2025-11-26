"use client";
import { useEffect, useState } from 'react';

interface Variant {
  sku_id?: string;
  sku_property?: string;
  sku_price?: string;
  sku_stock?: number;
  [key: string]: any;
}

interface SkuDetail {
  id: string;
  title: string;
  description: string;
  price: { current: number; original?: number | null; currency: string };
  images: { main: string; gallery: string[] };
  rating: { score: number; count: number };
  orders: number;
  shipping: { warehouse?: string; deliveryTime?: string; freeShipping?: boolean; cost?: number | null };
  merchant: { name?: string; id?: string | null };
  category: { id?: string; name?: string };
  urls: { product?: string; affiliate?: string; video?: string | null };
  variants: Variant[];
  specifications?: any;
}

export function useSkuDetail(productId?: string) {
  const [detail, setDetail] = useState<SkuDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetail() {
      if (!productId) return;
      setLoading(true);
      setError(null);
      try {
        const base = `${process.env.NEXT_PUBLIC_SITE_URL || ''}`;
        const res = await fetch(`${base}/api/admin/aliexpress/sku-detail?id=${encodeURIComponent(productId)}&lang=EN&currency=USD`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setDetail(data.product || null);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Nieznany błąd');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDetail();
    return () => { cancelled = true; };
  }, [productId]);

  return { detail, loading, error };
}
