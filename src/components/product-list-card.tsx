'use client';
// @ts-nocheck

import { useState, useEffect } from 'react';
import { ProductCore } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ShoppingCart, ExternalLink, Clock, Tag, Heart, Scale, Flame, Eye, Check, ArrowUp } from 'lucide-react';
import { useLocale, useTranslations, useFormatter } from 'next-intl';
import { cn } from '@/lib/utils';
import { getExternalUrl } from '@/lib/external-url';
import { useContentLanguage } from '@/hooks/use-content-language';
import { useSmartCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/unified-currency';
import { useCategoryName } from '@/hooks/use-category-name';
import { useCardBaseState } from '@/hooks/use-card-base-state';
import { formatTimeAgo } from '@/lib/format-relative-time';
import ShareButton from '@/components/share-button';
import { withImageProxy, isAliExpressImage } from '@/lib/image-proxy';

interface ProductListCardProps {
  product: ProductCore;
}

const safeText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim() || '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const resolveImageCandidate = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = resolveImageCandidate(entry);
      if (resolved) return resolved;
    }
    return '';
  }
  if (typeof value === 'object') {
    return resolveImageCandidate(
      (value as any).src ||
      (value as any).url ||
      (value as any).image ||
      (value as any).imageUrl
    );
  }
  return '';
};

const resolveProductImage = (product: ProductCore): string => {
  const image = resolveImageCandidate(product.images)
    || resolveImageCandidate((product as any).gallery)
    || resolveImageCandidate((product as any).imageUrl)
    || resolveImageCandidate((product as any).image)
    || resolveImageCandidate((product as any).metadata?.imageUrl)
    || resolveImageCandidate((product as any).metadata?.image);

  if (!image) return '/placeholder.png';
  if (image.startsWith('//')) {
    return `https:${image}`;
  }
  return image;
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
  const router = useRouter();
  const prefix = locale === 'pl' ? '' : `/${locale}`;
  
  const { getText } = useContentLanguage();
  
  // Try to get the slug first
  const rawSlug = (product as any).slug;
  const safeSlug = typeof rawSlug === 'string' ? rawSlug : (rawSlug ? getText(rawSlug) : null);
  
  // Ensure product has ID for links (fallback: use identityHash if no ID)
  const rawId = product.id || (product as any).docId || (product as any)._id || (product as any).identityHash;
  const safeId = typeof rawId === 'object' ? String(rawId) : rawId;
  const productId = safeSlug || safeId || 'unknown';
  const baseState = useCardBaseState(product, 'product', { disableInitialFavoriteCheck: true });
  const { isFavorited, isFavoriteLoading, toggleFavorite, addToComparison, t: tCommon } = baseState;
  const formatter = useFormatter();
  const { addItem } = useSmartCart();
  const { formatPrice, convertToPLN } = useCurrency();
  const { mainName: categoryLabel } = useCategoryName(product.mainCategorySlug, product.subCategorySlug, product.subSubCategorySlug);
  const [productData, setProductData] = useState({
    relativeTime: 'niedawno',
    formattedPrice: 'N/A',
  });
  const primaryImage = resolveProductImage(product);
  const [imageSrc, setImageSrc] = useState(() => withImageProxy(primaryImage) || '/placeholder.png');
  const isAliExpress = isAliExpressImage(primaryImage);
  const [bestDeal, setBestDeal] = useState<any | null>(null);
  const [bestTotalPrice, setBestTotalPrice] = useState<number | null>(product?.bestTotalPrice ?? product?.bestPrice?.amount ?? null);
  const hasCoupons = Boolean((product as any).hasCoupons || (product as any).metadata?.hasCoupons || (bestDeal && ((bestDeal.dealType === 'coupon') || bestDeal.couponCode)));
  const { addDeal, isInCart } = useSmartCart();
  const inCart = bestDeal ? isInCart(bestDeal.id || '') : false;

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
    let relTime = 'niedawno';
    if (product.createdAt) {
      try {
        const date = new Date(
          typeof product.createdAt === 'object' && typeof (product.createdAt as any).toDate === 'function'
            ? (product.createdAt as any).toDate()
            : typeof product.createdAt === 'object' && typeof (product.createdAt as any).seconds === 'number'
              ? ((product.createdAt as any).seconds * 1000) + (((product.createdAt as any).nanoseconds || 0) / 1e6)
              : product.createdAt
        );
        if (!isNaN(date.getTime())) {
          relTime = formatTimeAgo(date, tCommon);
        }
      } catch (err) {}
    }
    
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
    const priceInPLN = convertToPLN(rawPrice, sourceCurrency as any);

    // Format (hook formatPrice assumes input is in Base Currency PLN)
    const formatted = formatPrice(priceInPLN);

    setProductData({
      relativeTime: relTime,
      formattedPrice: formatted,
    });
  }, [product.createdAt, price, bestTotalPrice, product?.bestPrice?.amount, product?.bestPrice?.currency, bestDeal, formatPrice, formatter]);

  useEffect(() => {
    setImageSrc(withImageProxy(primaryImage) || '/placeholder.png');
  }, [primaryImage]);

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
            const dealShippingCost = deal.shipping?.cost ?? (deal as any).shippingCost ?? 0;
            const total = (deal.price.amount || 0) + dealShippingCost;
            if (total > 0) setBestTotalPrice(total);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [product.id]);

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
    <div className="group relative flex flex-row rounded-2xl border border-border/60 bg-card hover:bg-card/95 hover:border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 w-full">
      {/* Thumbnail Image Section */}
      <Link href={`${prefix}/products/${productId}`} className="relative flex-shrink-0 w-32 sm:w-44 md:w-48 bg-muted/30 flex items-center justify-center overflow-hidden group/img">
        <div className="relative w-full h-full min-h-[120px]">
          <Image
            src={imageSrc || '/placeholder.png'}
            alt={displayTitle}
            fill
            sizes="(max-width: 640px) 128px, (max-width: 768px) 176px, 192px"
            className="object-contain p-2 transition-transform duration-500 group-hover/img:scale-105"
            onError={() => setImageSrc('/placeholder.png')}
            unoptimized={isAliExpress}
          />
        </div>
        
        {/* Badges on Thumbnail */}
        <div className="absolute left-2 top-2 flex flex-col gap-1.5 z-10">
          {isNew && (
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md text-xs font-bold px-2 py-0.5">
              {tCommon('labels.isNew')}
            </Badge>
          )}
          {hasCoupons && (
            <Badge className="bg-purple-600 text-white shadow-md text-xs font-bold px-2 py-0.5">
              🎟️ {tCommon('labels.coupon')}
            </Badge>
          )}
        </div>
        
        {/* Social Proof Badge */}
        {((product as any)?.marketing?.ordersCount || 0) > 10 && (
          <div className="absolute right-2 top-2 z-10">
            <div className="bg-red-600/90 text-white text-[11px] px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1 shadow-sm font-semibold">
               <Flame className="w-3 h-3" />
               <span>
                 {tCommon('labels.boughtCount', { count: ((product as any)?.marketing?.ordersCount || 0) })}
               </span>
            </div>
          </div>
        )}
      </Link>

      {/* Content Section */}
      <div className="flex flex-col flex-grow min-w-0 px-3 py-3 gap-2 justify-between">
        {/* Top Row: Merchant, Category, Time, Rating on Left | Price Block on Right */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {((product as any).merchant || (product as any).merchantName || (product as any).source) && (
              <span className="font-semibold text-foreground bg-accent/50 px-1.5 py-0.5 rounded text-[11px]">
                {(product as any).merchant || (product as any).merchantName || (product as any).source}
              </span>
            )}
            {categoryLabel && (
              <Badge variant="secondary" className="flex items-center gap-0.5 text-[10px] font-medium h-4 px-1.5 py-0">
                <Tag className="h-2.5 w-2.5" aria-hidden />
                {categoryLabel}
              </Badge>
            )}
            {rating > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span>{rating.toFixed(1)}</span>
              </span>
            )}
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {productData.relativeTime}
            </span>
          </div>

          {/* Price block */}
          <div className="flex flex-col items-end gap-1 text-right shrink-0">
            <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-none">
              {productData.formattedPrice || 'N/A'}
            </p>
            {(product as any)?.bestPrice?.originalAmount && (product as any).bestPrice.originalAmount > (product as any).bestPrice.amount && (
              <div className="flex items-center gap-1.5 text-xs mt-0.5">
                <span className="text-muted-foreground/70 line-through font-medium">
                  {formatPrice(convertToPLN((product as any).bestPrice.originalAmount, (product as any).bestPrice.currency || 'PLN'))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <Link href={`${prefix}/products/${productId}`} className="group/title block">
            <h3 className="font-headline text-sm sm:text-base font-bold text-foreground group-hover/title:text-primary transition-colors line-clamp-2 leading-snug">
              {displayTitle}
            </h3>
          </Link>

          {description && (
            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 leading-relaxed mt-1 hidden sm:block">
              {description}
            </p>
          )}
        </div>

        {/* Bottom Row: 5 Action Buttons (identical to grid card) */}
        <div className="flex items-center justify-end gap-1 mt-auto pt-1 border-t border-border/30">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite();
            }}
            className={cn("ux-action-btn", isFavorited && "text-red-500 bg-red-500/10 opacity-100")}
            aria-label={isFavorited ? tCommon('auth.removeFromFavorites') : tCommon('auth.addToFavorites')}
            disabled={isFavoriteLoading}
            title={isFavorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            <Heart className={cn("h-3.5 w-3.5", isFavorited && "fill-current")} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToComparison({ ...product, type: 'product' } as any);
            }}
            className="ux-action-btn"
            aria-label={tCommon('comparison.addToComparison')}
            title="Porównaj"
          >
            <Scale className="h-3.5 w-3.5" />
          </button>
          <ShareButton
            type="product"
            itemId={productId}
            title={displayTitle}
            url={`/products/${productId}`}
            variant="ghost"
            size="icon"
            className="ux-action-btn"
          />
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (bestDeal && !inCart) {
                addDeal(bestDeal, 1);
              }
            }}
            disabled={!bestDeal || inCart}
            className={cn("ux-action-btn", inCart && "text-emerald-500 bg-emerald-500/10 opacity-100")}
            aria-label={inCart ? tCommon('cart.alreadyInCart') : tCommon('cart.addToCart')}
            title={inCart ? 'Już w koszyku' : 'Dodaj do koszyka'}
          >
            {inCart ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
          </button>
          <button
            className="ux-action-btn bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/35 border border-orange-400/30 opacity-95 hover:opacity-100 hover:scale-110 animate-bounce transition-all"
            onClick={(e) => {
              e.stopPropagation();
              if (offerUrl) {
                window.open(offerUrl, '_blank', 'noopener,noreferrer');
              } else {
                router.push(`${prefix}/products/${productId}`);
              }
            }}
            title={t('card.go')}
          >
            <ArrowUp className="h-3.5 w-3.5 rotate-90 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
}
