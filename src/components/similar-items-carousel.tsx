"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Deal, Product } from '@/lib/types';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import DealCard from './deal-card';
import ProductCard from './product-card';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from './ui/button';

interface SimilarItemsCarouselProps {
  itemId: string;
  itemType: 'deal' | 'product';
  category?: string;
  subcategory?: string;
  tags?: string[];
  subsubcategory?: string;
  priceRange?: [number, number];
  excludeItemId?: string;
  maxItems?: number;
}

export function SimilarItemsCarousel({
  itemId,
  itemType,
  category,
  subcategory,
  subsubcategory,
  tags = [],
  priceRange,
  excludeItemId,
  maxItems = 8,
}: SimilarItemsCarouselProps) {
  const [items, setItems] = useState<(Deal | Product)[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    fetchSimilarItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, category, subcategory, subsubcategory]);

  const fetchSimilarItems = async () => {
    setLoading(true);
    try {
      const collectionName = itemType === 'deal' ? 'deals' : 'products';
      let q = query(
        collection(db, collectionName),
        where('status', '==', 'approved'),
        orderBy('temperature', 'desc'),
        limit(maxItems * 2) // Fetch more to filter later
      );

      // Filter by category if provided (prefer deepest level)
      if (subsubcategory && subcategory) {
        q = query(
          collection(db, collectionName),
          where('status', '==', 'approved'),
          where('subCategorySlug', '==', subcategory),
          where('subSubCategorySlug', '==', subsubcategory),
          orderBy('temperature', 'desc'),
          limit(maxItems * 2)
        );
      } else if (subcategory) {
        q = query(
          collection(db, collectionName),
          where('status', '==', 'approved'),
          where('subCategorySlug', '==', subcategory),
          orderBy('temperature', 'desc'),
          limit(maxItems * 2)
        );
      } else if (category) {
        q = query(
          collection(db, collectionName),
          where('status', '==', 'approved'),
          where('mainCategorySlug', '==', category),
          orderBy('temperature', 'desc'),
          limit(maxItems * 2)
        );
      }

      const snapshot = await getDocs(q);
      let similarItems = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Deal | Product))
        .filter(item => item.id !== excludeItemId && item.id !== itemId);

      // Filter by price range if provided
      if (priceRange && itemType === 'deal') {
        const [minPrice, maxPrice] = priceRange;
        similarItems = similarItems.filter(item => {
          const deal = item as Deal;
          const rawP = deal.price;
          const price = typeof rawP === 'object' ? (rawP as any).amount : rawP || 0;
          return price >= minPrice && price <= maxPrice;
        });
      }

      // Boost items with matching tags
      if (tags.length > 0) {
        similarItems.sort((a, b) => {
          const aTags = (a as Deal).tags || [];
          const bTags = (b as Deal).tags || [];
          const aMatchingTags = aTags.filter((t: string) => tags.includes(t)).length;
          const bMatchingTags = bTags.filter((t: string) => tags.includes(t)).length;
          
          if (aMatchingTags !== bMatchingTags) {
            return bMatchingTags - aMatchingTags;
          }
          
          // Fall back to temperature
          const aTemp = (a as Deal).temperature || 0;
          const bTemp = (b as Deal).temperature || 0;
          return bTemp - aTemp;
        });
      }

      setItems(similarItems.slice(0, maxItems));
    } catch (error) {
      console.error('Error fetching similar items:', error);
      // Fallback: do not crash the page, just hide the carousel
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById(`similar-carousel-${itemId}`);
    if (!container) return;

    const scrollAmount = 300;
    const newPosition = direction === 'left' 
      ? Math.max(0, scrollPosition - scrollAmount)
      : Math.min(container.scrollWidth - container.clientWidth, scrollPosition + scrollAmount);

    container.scrollTo({ left: newPosition, behavior: 'smooth' });
    setScrollPosition(newPosition);
  };

  if (loading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Podobne {itemType === 'deal' ? 'okazje' : 'produkty'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-64 w-72 flex-shrink-0" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Podobne {itemType === 'deal' ? 'okazje' : 'produkty'}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('left')}
              disabled={scrollPosition === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          id={`similar-carousel-${itemId}`}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div key={item.id} className="flex-shrink-0 w-72">
              {itemType === 'deal' ? (
                <DealCard deal={item as Deal} />
              ) : (
                <ProductCard product={item as Product} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
