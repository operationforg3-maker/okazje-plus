"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { searchDealsTypesense, searchProductsTypesense } from '@/lib/search';
import type { Deal, ProductCore } from '@/lib/types';
import Image from 'next/image';

type MobileSearchModuleProps = {
  prefix: string;
  onNavigate?: () => void;
};

const IMAGE_FALLBACK = '/icon_okazjeplus.svg';

function productTitle(product: ProductCore): string {
  const title = product?.title as any;
  if (typeof title === 'string') return title;
  if (title?.pl) return String(title.pl);
  if (title?.en) return String(title.en);
  return 'Produkt';
}

function dealTitle(deal: Deal): string {
  const title = (deal as any)?.title;
  if (typeof title === 'string') return title;
  if (title?.pl) return String(title.pl);
  if (title?.en) return String(title.en);
  return 'Okazja';
}

function resolveImage(value: unknown): string {
  if (!value) return IMAGE_FALLBACK;
  if (typeof value === 'string') return value.trim() || IMAGE_FALLBACK;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = resolveImage(entry);
      if (resolved !== IMAGE_FALLBACK) return resolved;
    }
    return IMAGE_FALLBACK;
  }
  if (typeof value === 'object') {
    const obj = value as any;
    return resolveImage(obj?.src || obj?.url || obj?.image || obj?.imageUrl);
  }
  return IMAGE_FALLBACK;
}

function productImage(product: ProductCore): string {
  const p = product as any;
  return resolveImage(p?.image || p?.imageUrl || p?.mainImage || p?.images || p?.gallery);
}

function dealImage(deal: Deal): string {
  const d = deal as any;
  return resolveImage(d?.image || d?.imageUrl || d?.mainImage || d?.images || d?.gallery);
}

export function MobileSearchModule({ prefix, onNavigate }: MobileSearchModuleProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductCore[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'deals' | 'products'>('all');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const q = query.trim();
      if (q.length < 2) {
        setProducts([]);
        setDeals([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [prod, deal] = await Promise.all([
          searchProductsTypesense(q, { limit: 6, sortBy: 'relevance' }),
          searchDealsTypesense(q, { limit: 6, sortBy: 'relevance', statusFilter: 'approved' }),
        ]);

        if (!cancelled) {
          setProducts(prod || []);
          setDeals(deal || []);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setDeals([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const total = useMemo(() => products.length + deals.length, [products.length, deals.length]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj produktów i okazji..."
          className="pl-9"
          aria-label="Szukaj produktów i okazji"
          autoFocus
        />
      </div>

      {query.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">Wpisz co najmniej 2 znaki, aby zobaczyć wyniki.</p>
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">Znaleziono {total} wyników</div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'all' ? 'default' : 'outline'}
              onClick={() => setActiveTab('all')}
            >
              Wszystkie
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'deals' ? 'default' : 'outline'}
              onClick={() => setActiveTab('deals')}
            >
              Okazje
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeTab === 'products' ? 'default' : 'outline'}
              onClick={() => setActiveTab('products')}
            >
              Produkty
            </Button>
          </div>

          {(activeTab === 'all' || activeTab === 'deals') && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Okazje</h4>
              {deals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak okazji dla tego zapytania.</p>
              ) : (
                <div className="space-y-1">
                  {deals.map((deal) => (
                    <Link
                      key={deal.id}
                      href={`${prefix}/deals/${deal.id}`}
                      onClick={onNavigate}
                      className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                    >
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted/40">
                        <Image
                          src={dealImage(deal)}
                          alt={dealTitle(deal)}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      </div>
                      <span className="line-clamp-2">{dealTitle(deal)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {(activeTab === 'all' || activeTab === 'products') && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Produkty</h4>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak produktów dla tego zapytania.</p>
              ) : (
                <div className="space-y-1">
                  {products.map((product) => (
                    <Link
                      key={product.id}
                      href={`${prefix}/products/${product.id}`}
                      onClick={onNavigate}
                      className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                    >
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-muted/40">
                        <Image
                          src={productImage(product)}
                          alt={productTitle(product)}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      </div>
                      <span className="line-clamp-2">{productTitle(product)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          <Link
            href={`${prefix}/search?q=${encodeURIComponent(query.trim())}`}
            onClick={onNavigate}
            className="block rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
          >
            Zobacz pełne wyniki
          </Link>
        </div>
      )}
    </div>
  );
}
