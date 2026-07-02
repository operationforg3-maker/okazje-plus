'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Deal } from '@/lib/types';
import { UXRedesignDealCard } from '@/components/ux-redesign/deal-card';
import { searchDealsTypesense } from '@/lib/search';
import { Flame, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  initialDeals: Deal[];
}

export function UXPreviewDealsClient({ initialDeals }: Props) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [sortBy, setSortBy] = useState<'hot' | 'newest' | 'price_asc' | 'price_desc'>('hot');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialDeals.length >= 12);
  const [limit, setLimit] = useState(12);

  const loaderRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Handle Sort Change
  const handleSortChange = async (newSort: typeof sortBy) => {
    if (newSort === sortBy) return;
    setSortBy(newSort);
    setLoading(true);
    setHasMore(true);
    
    // Reset limit and load new sorted data
    const initialLimit = 12;
    setLimit(initialLimit);
    
    try {
      const results = await searchDealsTypesense('*', {
        limit: initialLimit,
        sortBy: newSort,
      });
      setDeals(results);
      if (results.length < initialLimit) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error sorting deals:', err);
    } finally {
      setLoading(false);
    }
  };

  // Infinite scroll logic
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading || !hasMore) return;

    const loadMoreDeals = async () => {
      setLoading(true);
      const newLimit = limit + 12;
      
      try {
        const results = await searchDealsTypesense('*', {
          limit: newLimit,
          sortBy,
        });

        if (results.length <= deals.length) {
          setHasMore(false);
        } else {
          // Slice only new items
          const newItems = results.slice(deals.length);
          setDeals((prev) => [...prev, ...newItems]);
          setLimit(newLimit);
          if (results.length < newLimit) {
            setHasMore(false);
          }
        }
      } catch (err) {
        console.error('Error loading more deals:', err);
      } finally {
        setLoading(false);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          loadMoreDeals();
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
  }, [deals.length, limit, sortBy, loading, hasMore]);

  const sortOptions = [
    { value: 'hot', label: 'Najgorętsze' },
    { value: 'newest', label: 'Najnowsze' },
    { value: 'price_asc', label: 'Cena: od najniższej' },
    { value: 'price_desc', label: 'Cena: od najwyższej' },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-12 space-y-12">
      {/* Header and Title */}
      <div className="space-y-4 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center justify-center bg-orange-500/10 text-orange-500 h-12 w-12 rounded-2xl mb-2">
          <Flame className="h-6 w-6 animate-pulse" />
        </div>
        <h1 className="font-headline text-3xl sm:text-5xl font-black tracking-tight text-foreground">
          Gorące Promocje i Okazje
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-medium">
          Odkryj najlepsze okazje ocenione przez naszą społeczność. Przewijaj dalej, aby zobaczyć nieskończony strumień promocji.
        </p>
      </div>

      {/* Sorting Tabs / Chips */}
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

      {/* Deals Grid */}
      {deals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {deals.map((deal, idx) => (
            <UXRedesignDealCard 
              key={`${deal.id}-${idx}`} 
              deal={deal} 
              priority={idx < 4}
            />
          ))}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-24 text-muted-foreground bg-muted/10 border border-dashed rounded-3xl">
            Nie znaleziono żadnych okazji
          </div>
        )
      )}

      {/* Loader / Infinite Scroll trigger */}
      <div ref={loaderRef} className="py-12 flex justify-center items-center">
        {loading && (
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Wczytywanie kolejnych okazji...
          </div>
        )}
        {!hasMore && deals.length > 0 && (
          <span className="text-xs text-muted-foreground font-medium">
            Dotarłeś do końca! Brak kolejnych okazji.
          </span>
        )}
      </div>
    </div>
  );
}
