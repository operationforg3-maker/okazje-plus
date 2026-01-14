'use client';
// @ts-nocheck

import { useState, useEffect } from 'react';
import { ProductCore } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ShoppingCart, ExternalLink, Clock, Tag, Heart, Scale } from 'lucide-react';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { useContentLanguage } from '@/hooks/use-content-language';
import { useFavorites } from '@/hooks/use-favorites';
import { useSmartCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/unified-currency';

interface ProductListCardProps {
  product: ProductCore;
}

const safeText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim() || '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const getRelativeTime = (timestamp: any): string => {
  try {
    const date = new Date(
      typeof timestamp === 'object' && typeof (timestamp as any).toDate === 'function'
        ? (timestamp as any).toDate()
        : typeof timestamp === 'object' && typeof (timestamp as any).seconds === 'number'
          ? ((timestamp as any).seconds * 1000) + (((timestamp as any).nanoseconds || 0) / 1e6)
          : timestamp
    );

    if (isNaN(date.getTime())) return 'niedawno';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return 'przed chwilą';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m temu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h temu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d temu`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w temu`;

    return date.toLocaleDateString('pl-PL');
  } catch {
    return 'niedawno';
  }
};

export default function ProductListCard({ product }: ProductListCardProps) {
  const locale = useLocale();
  const prefix = locale ? `/${locale}` : '';
  
  // Ensure product has ID for links (fallback: use identityHash if no ID)
  const productId = product.id || (product as any).identityHash || 'unknown';
  
  const { getText } = useContentLanguage();
  const { isFavorited, isLoading: favLoading, toggleFavorite } = useFavorites(productId, 'product');
  const { addItem, isInCart } = useSmartCart();
  const { formatPrice } = useCurrency();
  const [productData, setProductData] = useState({
    relativeTime: 'niedawno',
    formattedPrice: 'N/A',
  });
  const [bestDeal, setBestDeal] = useState<any | null>(null);
  const [bestTotalPrice, setBestTotalPrice] = useState<number | null>(product?.bestTotalPrice ?? null);

  // Get title in current language (ProductCore has multilingual title)
  const displayTitle = typeof product.title === 'object'
    ? (product.title.pl || product.title.en || product.title.de || 'Produkt')
    : (product.title || 'Produkt');
  
  // Description - ProductCore shortDescription is multilingual
  const descriptionText = typeof product.shortDescription === 'object'
    ? (product.shortDescription.pl || product.shortDescription.en || product.shortDescription.de || '')
    : (product.shortDescription || '');
  const description = safeText(descriptionText).substring(0, 120);

  // Price from ProductCore.bestPrice (fallback)
  const price = product.bestPrice?.amount || 0;

  const categoryLabel = product.mainCategorySlug || product.subCategorySlug || null;
  const rating = product.rating?.score || 0;
  const ratingCount = product.rating?.count || 0;

  // Check if product is new (created less than 7 days ago)
  const isNew = (() => {
    try {
      if (!product.createdAt) return false;
      const created = new Date(product.createdAt);
      const now = new Date();
      const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    const relTime = getRelativeTime(product.createdAt);
    const formatted = formatPrice(bestTotalPrice ?? price);

    setProductData({
      relativeTime: relTime,
      formattedPrice: formatted,
    });
  }, [product.createdAt, price, bestTotalPrice, formatPrice]);

  // Fetch best deal for this product to get accurate affiliate link and total price
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getBestDealForProduct } = await import('@/lib/data');
        const deal = await getBestDealForProduct(product.id);
        if (!cancelled) {
          setBestDeal(deal);
          // Jeśli produkt ma już bestTotalPrice, użyj go. W przeciwnym wypadku policz z dealu.
          if (product?.bestTotalPrice && product.bestTotalPrice > 0) {
            setBestTotalPrice(product.bestTotalPrice);
          } else {
            const total = (deal?.price?.amount || 0) + (deal?.shipping?.cost || 0);
            if (total > 0) setBestTotalPrice(total);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [product.id]);

  // Get primary image from ProductCore gallery
  const primaryImage = Array.isArray(product.images) && product.images.length > 0
    ? product.images[0]
    : '/placeholder.png';

  return (
    <div className="group flex flex-col sm:flex-row bg-card p-3 sm:p-4 rounded-lg border items-stretch gap-3 sm:gap-4 w-full max-w-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
      {/* Image - Top on mobile, left on desktop */}
      <Link href={`${prefix}/products/${productId}`} className="relative flex-shrink-0 overflow-hidden rounded-md w-full sm:w-40">
        <div className="relative w-full aspect-[4/3] sm:aspect-square sm:h-40 bg-muted">
          <Image
            src={primaryImage}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 100vw, 160px"
            className="object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {isNew && (
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg text-xs">
              Nowość
            </Badge>
          )}
        </div>
      </Link>

      {/* Content - Middle */}
      <div className="flex flex-col flex-grow min-w-0 justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Link href={`${prefix}/products/${productId}`} className="group/title flex-1 min-w-0">
              <h3 className="font-headline text-base sm:text-lg md:text-xl font-semibold group-hover/title:text-primary transition-colors line-clamp-2 break-words">
                {displayTitle}
              </h3>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {productData.relativeTime}
            </span>
            {categoryLabel && (
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <Tag className="h-3 w-3" aria-hidden />
                {categoryLabel}
              </Badge>
            )}
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 break-words">
            {description}
          </p>

          {/* Rating */}
          {rating > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3 w-3',
                      i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                    )}
                  />
                ))}
              </div>
              {ratingCount > 0 && (
                <span className="text-xs text-muted-foreground">({ratingCount} ocen)</span>
              )}
            </div>
          )}
        </div>

        {/* Price info */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-2xl font-bold text-primary">{productData.formattedPrice}</p>
          </div>
        </div>
      </div>

      {/* Actions - Bottom on mobile, right on desktop */}
      <div className="flex flex-col items-stretch sm:items-center justify-between gap-3 sm:pl-4 sm:border-l w-full sm:w-auto">
        <div className="text-right text-xs text-muted-foreground flex flex-col items-center gap-1">
          {ratingCount > 0 && (
            <span className="text-xs">{ratingCount} opinii</span>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full sm:min-w-[200px]">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full whitespace-nowrap"
          >
            <a
              href={(bestDeal?.affiliateLink || bestDeal?.dealUrl || bestDeal?.sourceUrl || '#')}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Przejdź do oferty
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            className="w-full whitespace-nowrap"
          >
            <Link href={`${prefix}/products/${productId}`}>
              <ShoppingCart className="h-4 w-4 mr-1" />
              Szczegóły
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2 w-full">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => addItem({
                id: bestDeal?.id || productId,
                name: typeof product.title === 'object' ? (product.title.pl || product.title.en || 'Produkt') : (product.title as any) || 'Produkt',
                image: Array.isArray(product.images) ? product.images[0] : '',
                price: { amount: (bestTotalPrice ?? (product.bestPrice?.amount || 0)), currency: 'PLN' } as any,
                affiliateUrl: (bestDeal?.affiliateLink || bestDeal?.dealUrl || bestDeal?.sourceUrl),
              } as any, 1)}
              disabled={isInCart(bestDeal?.id || productId)}
              className="flex-1 text-xs sm:text-sm"
            >
              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">{isInCart(productId) ? 'W koszyku' : 'Do koszyka'}</span>
              <span className="sm:hidden">Koszyk</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toggleFavorite()}
              disabled={favLoading}
              className="flex-1 text-xs sm:text-sm"
            >
              <Heart className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="hidden sm:inline">{isFavorited ? 'Ulubione' : 'Ulubione'}</span>
              <span className="sm:hidden">❤️</span>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="flex-1 text-xs sm:text-sm"
            >
              <Link href={`${prefix}/products/${productId}#price-comparison`}>
                <Scale className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Porównaj</span>
                <span className="sm:hidden">⚖️</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
