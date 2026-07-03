'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Product } from '@/lib/types';
import { UXRedesignProductCard } from '@/components/ux-redesign/product-card';
import { searchProductsTypesense } from '@/lib/search';
import { ShoppingBag, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  initialProducts: Product[];
}

export function UXPreviewProductsClient({ initialProducts }: Props) {
  const [products, setProducts] = useState<any[]>(initialProducts);
  const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'rating'>('relevance');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialProducts.length >= 12);
  const [limit, setLimit] = useState(12);

  const loaderRef = useRef<HTMLDivElement>(null);

  // Handle Sort Change
  const handleSortChange = async (newSort: typeof sortBy) => {
    if (newSort === sortBy) return;
    setSortBy(newSort);
    setLoading(true);
    setHasMore(true);

    const initialLimit = 12;
    setLimit(initialLimit);

    try {
      const results = await searchProductsTypesense('*', {
        limit: initialLimit,
        sortBy: newSort as any,
      });
      setProducts(results);
      if (results.length < initialLimit) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error sorting products:', err);
    } finally {
      setLoading(false);
    }
  };

  // Infinite Scroll Logic
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading || !hasMore) return;

    const loadMoreProducts = async () => {
      setLoading(true);
      const newLimit = limit + 12;

      try {
        const results = await searchProductsTypesense('*', {
          limit: newLimit,
          sortBy: sortBy as any,
        });

        if (results.length <= products.length) {
          setHasMore(false);
        } else {
          const newItems = results.slice(products.length);
          setProducts((prev) => [...prev, ...newItems]);
          setLimit(newLimit);
          if (results.length < newLimit) {
            setHasMore(false);
          }
        }
      } catch (err) {
        console.error('Error loading more products:', err);
      } finally {
        setLoading(false);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          loadMoreProducts();
        }
      },
      { rootMargin: '200px' }
    );

    const currentLoader = loaderRef.current;
    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
      observer.disconnect();
    };
  }, [products.length, limit, sortBy, loading, hasMore]);

  const sortOptions = [
    { value: 'relevance', label: 'Domyślne' },
    { value: 'rating', label: 'Najlepiej oceniane' },
    { value: 'price_asc', label: 'Najtańsze' },
    { value: 'price_desc', label: 'Najdroższe' },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-12 space-y-12">
      {/* Header and Title */}
      <div className="space-y-4 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center bg-primary/10 text-primary h-12 w-12 rounded-2xl mb-2">
          <ShoppingBag className="h-6 w-6 animate-pulse" />
        </div>
        <h1 className="font-headline text-3xl sm:text-5xl font-black tracking-tight text-foreground">
          Katalog Produktów i Marek
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-medium">
          Przeglądaj, porównuj i oszczędzaj na markowych artykułach. Przewijaj w dół, aby załadować kolejne produkty w czasie rzeczywistym.
        </p>
      </div>

      {/* Sorting Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border/40 pb-6">
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSortChange(opt.value)}
            disabled={loading}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border",
              sortBy === opt.value
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-background border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.value === sortBy && loading && (
              <RefreshCw className="inline-block mr-1.5 h-3 w-3 animate-spin" />
            )}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product, idx) => (
            <UXRedesignProductCard 
              key={`${product.id}-${idx}`} 
              product={product}
              previewMode
            />
          ))}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-24 text-muted-foreground bg-muted/10 border border-dashed rounded-3xl">
            Nie znaleziono żadnych produktów
          </div>
        )
      )}

      {/* Loader */}
      <div ref={loaderRef} className="py-12 flex justify-center items-center">
        {loading && (
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Wczytywanie kolejnych produktów...
          </div>
        )}
        {!hasMore && products.length > 0 && (
          <span className="text-xs text-muted-foreground font-medium">
            Dotarłeś do końca! Brak kolejnych produktów.
          </span>
        )}
      </div>
    </div>
  );
}
