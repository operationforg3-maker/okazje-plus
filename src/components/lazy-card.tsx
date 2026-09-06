/**
 * LazyDealCard Component
 * 
 * Lazy-loads DealCard with dynamic import + Suspense
 * Reduces initial bundle and improves FCP/LCP
 * 
 * Usage:
 * <LazyDealCard deal={deal} product={product} />
 */

'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Deal, Product } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const DealCardDynamic = dynamic(
  () => import('@/components/deal-card'),
  {
    loading: () => <CardSkeleton />,
    ssr: true, // Server-side render for SEO
  }
);

interface LazyDealCardProps {
  deal: Deal;
  product?: Product | null;
  layoutMode?: 'grid' | 'masonry' | 'list';
  index?: number;
}

export function LazyDealCard({ deal, product, layoutMode, index }: LazyDealCardProps) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <DealCardDynamic deal={deal} product={product} layoutMode={layoutMode} />
    </Suspense>
  );
}

export function LazyProductCard({
  product,
}: {
  product: Product;
}) {
  const ProductCardDynamic = dynamic(
    () => import('@/components/product-card'),
    {
      loading: () => <CardSkeleton />,
      ssr: true,
    }
  );

  return (
    <Suspense fallback={<CardSkeleton />}>
      <ProductCardDynamic product={product} />
    </Suspense>
  );
}

/**
 * CardSkeleton - Loading placeholder for cards
 * Matches card dimensions to prevent layout shift
 */
export function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="h-40 w-full bg-muted" />
      
      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        
        {/* Price section */}
        <div className="space-y-2 pt-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        
        {/* Buttons */}
        <div className="flex gap-2 pt-3">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>
      </div>
    </div>
  );
}

LazyDealCard.displayName = 'LazyDealCard';
LazyProductCard.displayName = 'LazyProductCard';
