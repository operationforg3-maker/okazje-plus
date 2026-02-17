'use client';
// @ts-nocheck

import { useState, useEffect } from 'react';
import { ProductCore } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ShoppingCart, ExternalLink, Clock, Tag, Heart, Scale, Flame } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { getExternalUrl } from '@/lib/external-url';
import { useContentLanguage } from '@/hooks/use-content-language';
import { useSmartCart } from '@/lib/cart-context';
import { useCurrency, CurrencyManager } from '@/lib/unified-currency';
import { useCategoryName } from '@/hooks/use-category-name';
import { useCardBaseState } from '@/hooks/use-card-base-state';
import ShareButton from '@/components/share-button';

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
  const t = useTranslations('products');
  const prefix = locale ? `/${locale}` : '';
  
  // Ensure product has ID for links (fallback: use identityHash if no ID)
  const productId = product.id || (product as any).identityHash || 'unknown';
  
  const { getText } = useContentLanguage();
  const baseState = useCardBaseState(product, 'product');
  const { isFavorited, isFavoriteLoading, toggleFavorite, addToComparison, t: tCommon } = baseState;
  const { addItem } = useSmartCart();
  const { formatPrice } = useCurrency();
  const { mainName: categoryLabel } = useCategoryName(product.mainCategorySlug, product.subCategorySlug, product.subSubCategorySlug);
  const [productData, setProductData] = useState({
    relativeTime: 'niedawno',
    formattedPrice: 'N/A',
  });
  const [bestDeal, setBestDeal] = useState<any | null>(null);
  const [bestTotalPrice, setBestTotalPrice] = useState<number | null>(product?.bestTotalPrice ?? product?.bestPrice?.amount ?? null);
  const hasCoupons = Boolean((product as any).hasCoupons || (product as any).metadata?.hasCoupons || (bestDeal && ((bestDeal.dealType === 'coupon') || bestDeal.couponCode)));

  // Get title in current language (ProductCore has multilingual title)
  const displayTitle = getText(product.title) || 'Produkt';
  
  // Description - ProductCore shortDescription is multilingual
  const descriptionText = getText(product.shortDescription) || '';
  const description = safeText(descriptionText).substring(0, 120);

  // Price from ProductCore.bestPrice (fallback)
  const price = product.bestPrice?.amount || 0;

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
    
    // Determine raw price and source currency
    let rawPrice = bestTotalPrice ?? product?.bestPrice?.amount ?? price;
    let sourceCurrency = 'PLN';

    // If we have a specific best deal, use its currency
    if (bestDeal && bestDeal.price?.currency) {
      sourceCurrency = bestDeal.price.currency;
    } else if (product?.bestPrice?.currency) {
      // Fallback to ProductCore best price currency
      sourceCurrency = product.bestPrice.currency;
    }

    // Convert to PLN Base (CurrencyManager expects Source -> Base)
    const priceInPLN = CurrencyManager.convertToPLN(rawPrice, sourceCurrency);

    // Format (hook formatPrice assumes input is in Base Currency PLN)
    const formatted = formatPrice(priceInPLN);

    setProductData({
      relativeTime: relTime,
      formattedPrice: formatted,
    });
  }, [product.createdAt, price, bestTotalPrice, product?.bestPrice?.amount, product?.bestPrice?.currency, bestDeal, formatPrice]);

  // Fetch best deal for this product to get accurate affiliate link and total price
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getBestDealForProduct } = await import('@/lib/data');
        const deal = await getBestDealForProduct(product.id);
        if (!cancelled) {
          setBestDeal(deal);
          if (deal && deal.price?.amount) {
            const total = (deal.price.amount || 0) + (deal.shipping?.cost || 0);
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

  const offerUrl = bestDeal
    ? getExternalUrl(
        bestDeal.affiliateLink,
        bestDeal.affiliateUrl,
        bestDeal.dealUrl,
        bestDeal.sourceUrl,
        bestDeal.link
      )
    : null;

  return (
    <div className="group relative flex flex-col sm:flex-row rounded-xl border bg-card p-3 sm:p-4 md:p-5 items-stretch gap-3 sm:gap-5 w-full transition-shadow duration-200 hover:shadow-md">
      {/* Image - Top on mobile, left on desktop */}
      <Link href={`${prefix}/products/${productId}`} className="relative flex-shrink-0 overflow-hidden rounded-lg border bg-muted/40">
        <div className="relative w-full sm:w-32 md:w-40 h-48 sm:h-24 md:h-32 bg-muted/50">
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
              {t('card.new', { default: 'Nowość' } as any)}
            </Badge>
          )}
          {hasCoupons && (
            <Badge className="bg-purple-600 text-white shadow-lg text-xs">
              🎟️ Kupon
            </Badge>
          )}
        </div>
        
        {/* Social Proof Badge (Top-Right) */}
        {((product as any)?.marketing?.ordersCount || 0) > 10 && (
          <div className="absolute right-2 top-2 z-10">
            <div className="bg-red-600/90 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm flex items-center gap-1 shadow-sm">
               <Flame className="w-3 h-3" />
               <span className="font-medium">
                 {((product as any)?.marketing?.ordersCount)} kupiło
               </span>
            </div>
          </div>
        )}
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

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {productData.relativeTime}
            </span>
            {categoryLabel && (
              <>
                <span aria-hidden>•</span>
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Tag className="h-3 w-3" aria-hidden />
                  {categoryLabel}
                </Badge>
              </>
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

        {/* Price info - Matching DealListCard style (Bottom Left of Middle) */}
        <div className="flex items-center justify-between mt-2">
           <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-2xl font-bold text-primary">{productData.formattedPrice}</p>
            
            {/* We don't have original price easily available in ProductCore top-level usually, but if we did */}
            {(product as any)?.bestPrice?.originalAmount && (product as any).bestPrice.originalAmount > (product as any).bestPrice.amount && (
               <p className="text-base text-muted-foreground line-through">
                 {formatPrice(CurrencyManager.convertToPLN((product as any).bestPrice.originalAmount, (product as any).bestPrice.currency || 'PLN'))}
               </p>
            )}
           </div>
        </div>
      </div>

      {/* Action Buttons - Right Column (Matches DealListCard 3-col layout) */}
      <div className="flex flex-col items-center justify-center gap-3 pt-3 sm:pt-0 pl-0 sm:pl-4 border-t sm:border-t-0 sm:border-l w-full sm:w-auto sm:min-w-[180px]">
        <div className="grid grid-cols-3 gap-2 w-full">
          <Button
            variant={isFavorited ? "default" : "outline"}
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite();
            }}
            aria-label={isFavorited ? tCommon('auth.removeFromFavorites') : tCommon('auth.addToFavorites')}
            disabled={isFavoriteLoading}
            className={isFavorited ? "h-9 w-9 p-0 bg-red-500 hover:bg-red-600" : "h-9 w-9 p-0"}
          >
            <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
          </Button>
          <ShareButton
            type="product"
            itemId={productId}
            title={displayTitle}
            url={`/products/${productId}`}
            variant="outline"
            size="icon"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToComparison({ ...product, type: 'product' } as any);
            }}
            aria-label={tCommon('comparison.addToComparison')}
          >
            <Scale className="h-4 w-4" />
          </Button>
        </div>

        {/* Primary Action - Go To Offer */}
        {offerUrl ? (
          <Button
            asChild
            size="lg"
            className="w-full whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <a
              href={offerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('card.go')}
            </a>
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full whitespace-nowrap bg-emerald-600 text-white opacity-80"
            disabled
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('card.go')}
          </Button>
        )}

        {/* Secondary Action - Details */}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full gap-1"
        >
          <Link href={`${prefix}/products/${productId}`}>
            <ShoppingCart className="h-4 w-4 mr-1" />
            {t('card.details')}
          </Link>
        </Button>
        
        {/* Quick Cart Action */}
        <Button
          size="sm"
          variant="ghost"
          className="w-full gap-1 text-muted-foreground hover:text-primary"
          onClick={(e) => {
            e.preventDefault();
            addItem({
              id: bestDeal?.id || productId,
              name: getText(product.title) || 'Produkt',
              image: Array.isArray(product.images) ? product.images[0] : '',
              price: { amount: (bestTotalPrice ?? (product.bestPrice?.amount || 0)), currency: 'PLN' } as any,
              affiliateUrl: (bestDeal?.affiliateLink || bestDeal?.affiliateUrl || bestDeal?.dealUrl || bestDeal?.sourceUrl || bestDeal?.link),
            } as any, 1);
          }}
        >
          <span className="text-xs">+ {t('card.cart', {default: 'Do koszyka'})}</span>
        </Button>
      </div>
    </div>
  );
}
