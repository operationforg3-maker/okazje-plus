'use client';

import { useState, useEffect, useRef } from 'react';
import { Deal, ProductCore } from '@/lib/types';
import DealCard from '@/components/deal-card';
import ProductCard from '@/components/product-card';
import { Loader2 } from 'lucide-react';

interface CategoryFilterPayload {
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
}

interface InfiniteSimilarFeedProps {
  itemType: 'deal' | 'product';
  categoryId?: string; // Legacy fallback
  categoryQueue?: CategoryFilterPayload[];
  excludeId: string;
}

export function InfiniteSimilarFeed({ itemType, categoryId, categoryQueue, excludeId }: InfiniteSimilarFeedProps) {
  const [items, setItems] = useState<(Deal | ProductCore)[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [queueIndex, setQueueIndex] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Normalize queue of categories
  const resolvedQueue = categoryQueue && categoryQueue.length > 0
    ? categoryQueue
    : (categoryId ? [{ mainCategorySlug: categoryId }] : [{}]);

  useEffect(() => {
    // Reset state if category changes
    setItems([]);
    setPage(1);
    setQueueIndex(0);
    setHasMore(true);
  }, [categoryId, JSON.stringify(categoryQueue)]);

  useEffect(() => {
    if (!hasMore || isLoading) return;

    const fetchNextPage = async () => {
      setIsLoading(true);
      try {
        const queryType = itemType === 'deal' ? 'deals' : 'products';
        const currentFilter = resolvedQueue[queueIndex] || {};

        const params = new URLSearchParams({
          type: queryType,
          limit: '20',
          page: String(page),
          q: '*',
        });

        if (currentFilter.mainCategorySlug) {
          params.set('mainCategorySlug', currentFilter.mainCategorySlug);
        }
        if (currentFilter.subCategorySlug) {
          params.set('subCategorySlug', currentFilter.subCategorySlug);
        }
        if (currentFilter.subSubCategorySlug) {
          params.set('subSubCategorySlug', currentFilter.subSubCategorySlug);
        }

        const res = await fetch(`/api/search?${params.toString()}`);
        if (!res.ok) throw new Error('Search failed');

        const data = await res.json();
        const newItems: (Deal | ProductCore)[] = itemType === 'deal' ? data.deals : data.products;

        if (newItems.length === 0) {
          // If we run out of items at this level, check if we can step up in the queue
          if (queueIndex < resolvedQueue.length - 1) {
            setQueueIndex((prev) => prev + 1);
            setPage(1); // Reset page for the next category level
          } else {
            setHasMore(false); // Fully finished the entire category tree fallback queue
          }
        } else {
          // Filter out duplicates and excluded ID
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const filtered = newItems.filter((i) => i.id !== excludeId && !existingIds.has(i.id));
            if (filtered.length === 0 && newItems.length > 0) {
              // If everything was filtered out, load the next page
              setPage((p) => p + 1);
            }
            return [...prev, ...filtered];
          });
        }
      } catch (err) {
        console.error('Error loading similar items feed:', err);
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNextPage();
  }, [page, queueIndex, itemType, excludeId, hasMore, JSON.stringify(resolvedQueue)]);

  // Observer to trigger next page load
  useEffect(() => {
    const currentTarget = observerTarget.current;
    if (!currentTarget || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(currentTarget);

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [hasMore, isLoading, items]);

  return (
    <div className="space-y-8">
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => {
            if (itemType === 'deal') {
              return <DealCard key={item.id} deal={item as any} />;
            } else {
              return <ProductCard key={item.id} product={item as any} />;
            }
          })}
        </div>
      )}

      {/* Loading indicator / Observer Target */}
      <div ref={observerTarget} className="py-8 flex justify-center items-center min-h-[80px]">
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Ładowanie kolejnych propozycji...</span>
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <p className="text-sm text-muted-foreground">To już wszystkie podobne propozycje.</p>
        )}
      </div>
    </div>
  );
}
