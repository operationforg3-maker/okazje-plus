'use client';
// @ts-nocheck

import { useState, useEffect } from 'react';
import { ProductCore } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ShoppingCart, ExternalLink, Clock, Tag } from 'lucide-react';
import { useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { useContentLanguage } from '@/hooks/use-content-language';

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
  const { getText } = useContentLanguage();
  const [productData, setProductData] = useState({
    relativeTime: 'niedawno',
    formattedPrice: 'N/A',
  });

  // Get title in current language (ProductCore has multilingual title)
  const displayTitle = typeof product.title === 'object'
    ? (product.title.pl || product.title.en || product.title.de || 'Produkt')
    : (product.title || 'Produkt');
  
  // Description - ProductCore shortDescription is multilingual
  const descriptionText = typeof product.shortDescription === 'object'
    ? (product.shortDescription.pl || product.shortDescription.en || product.shortDescription.de || '')
    : (product.shortDescription || '');
  const description = safeText(descriptionText).substring(0, 120);

  // Price from ProductCore.bestPrice
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
    const formatted = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(price);

    setProductData({
      relativeTime: relTime,
      formattedPrice: formatted,
    });
  }, [product.createdAt, price]);

  // Get primary image from ProductCore gallery
  const primaryImage = Array.isArray(product.images) && product.images.length > 0
    ? product.images[0]
    : '/placeholder.png';

  return (
    <div className="group flex bg-card p-5 rounded-lg border items-stretch gap-6 w-full hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
      {/* Image - Left */}
      <Link href={`${prefix}/products/${product.id}`} className="relative flex-shrink-0 overflow-hidden rounded-md">
        <div className="relative w-40 h-32 bg-muted">
          <Image
            src={primaryImage}
            alt={displayTitle}
            fill
            sizes="160px"
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
            <Link href={`${prefix}/products/${product.id}`} className="group/title">
              <h3 className="font-headline text-xl font-semibold group-hover/title:text-primary transition-colors line-clamp-2">
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

          <p className="text-sm text-muted-foreground line-clamp-2">
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

      {/* Actions - Right */}
      <div className="flex flex-col items-center justify-between gap-3 pl-4 border-l">
        <div className="text-right text-xs text-muted-foreground flex flex-col items-center gap-1">
          {ratingCount > 0 && (
            <span className="text-xs">{ratingCount} opinii</span>
          )}
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="whitespace-nowrap"
          >
            <a href={product.affiliateUrl || '#'} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Przejdź
            </a>
          </Button>
          <Button
            asChild
            size="sm"
            className="whitespace-nowrap"
          >
            <Link href={`${prefix}/products/${product.id}`}>
              <ShoppingCart className="h-4 w-4 mr-1" />
              Szczegóły
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
