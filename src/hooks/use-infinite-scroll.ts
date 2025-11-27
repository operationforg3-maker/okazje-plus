import { useState, useEffect, useCallback, useRef } from 'react';

export interface InfiniteScrollConfig<T> {
  items: T[];
  initialItemsPerPage?: number;
  loadMoreThreshold?: number; // pixels from bottom to trigger load
}

/**
 * Hook do infinite scroll - ładuje kolejne elementy po zjechaniu na dół strony
 */
export function useInfiniteScroll<T>({
  items,
  initialItemsPerPage = 20,
  loadMoreThreshold = 500,
}: InfiniteScrollConfig<T>) {
  const [displayedItems, setDisplayedItems] = useState<T[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Inicjalizacja - pokaż pierwsze elementy
  useEffect(() => {
    const initial = items.slice(0, initialItemsPerPage);
    setDisplayedItems(initial);
    setCurrentIndex(initialItemsPerPage);
    setHasMore(initialItemsPerPage < items.length);
  }, [items, initialItemsPerPage]);

  // Funkcja ładująca kolejne elementy
  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    
    // Symulujemy krótkie opóźnienie dla UX (aby pokazać loader)
    setTimeout(() => {
      const nextIndex = currentIndex + initialItemsPerPage;
      const newItems = items.slice(currentIndex, nextIndex);
      
      setDisplayedItems(prev => [...prev, ...newItems]);
      setCurrentIndex(nextIndex);
      setHasMore(nextIndex < items.length);
      setIsLoading(false);
    }, 300);
  }, [currentIndex, hasMore, isLoading, items, initialItemsPerPage]);

  // Intersection Observer - wykrywa gdy użytkownik zjeżdża blisko końca
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { rootMargin: `${loadMoreThreshold}px` }
    );

    observer.observe(target);

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, isLoading, loadMore, loadMoreThreshold]);

  // Reset gdy zmienią się items (nowe filtry, kategorie itp.)
  useEffect(() => {
    const initial = items.slice(0, initialItemsPerPage);
    setDisplayedItems(initial);
    setCurrentIndex(initialItemsPerPage);
    setHasMore(initialItemsPerPage < items.length);
    setIsLoading(false);
  }, [items, initialItemsPerPage]);

  return {
    displayedItems,
    hasMore,
    isLoading,
    observerTarget,
    loadMore,
    totalItems: items.length,
    displayedCount: displayedItems.length,
  };
}
