// @ts-nocheck
"use client";

import { ProductGallery } from '../product-gallery';
import Link from 'next/link';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { withImageProxy } from '@/lib/image-proxy';
import { 
  Star, Tag, ExternalLink, Heart, MessageSquare, Truck, Package, 
  Zap, AlertTriangle, ShieldCheck, Info, Share2, ShoppingCart, 
  TrendingDown, Award, Clock, Check, Plus, Eye, Scale, Flame, TrendingUp, Sparkles,
  ArrowUp
} from 'lucide-react';
import { RatingBar } from '../rating-bar';
import { useCommentsCount } from '@/hooks/use-comments-count';
import type { Product } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import ShareButton from '@/components/share-button';
import React, { useEffect, useState } from 'react';
import { trackFirestoreView, trackFirestoreClick, trackFirestoreShare } from '@/lib/analytics';
import { AdminQuickActions } from '@/components/admin/admin-quick-actions';
// import ProductEditDialog from '@/components/admin/product-edit-dialog';
import { useSmartCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/unified-currency';
import { 
  extractPriceInfo, 
  getDiscountPercent 
} from '@/lib/i18n-utils';
import { cn } from '@/lib/utils';
import { useCardBaseState } from '@/hooks/use-card-base-state';
import { CardHeader } from '@/components/ui/card-header';
import { getExternalUrl } from '@/lib/external-url';
import { useUX } from '@/context/UXContext';

interface ProductCardProps {
  product: Product;
  showFullDetails?: boolean;
  viewMode?: 'list' | 'grid';
  fetchBestDeal?: boolean;
}

const safeText = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

function ProductCard({ product, showFullDetails = false, viewMode = 'grid', layoutMode = 'grid', fetchBestDeal = false }: ProductCardProps & { layoutMode?: 'grid' | 'masonry' | 'list' }) {
  const { cardDensity } = useUX();
  const details = cardDensity === 'compact' ? 'compact' : 'expanded';
  const params = useParams();
  const router = useRouter();
  const localeFromParams = (params?.locale as string) || 'pl';
  const [locale, setLocale] = useState(() => localeFromParams);
  const prefix = `/${locale}`;
  const baseState = useCardBaseState(product, 'product', { disableInitialFavoriteCheck: true });
  const { getText, addToComparison, user, isFavorited, isFavoriteLoading, toggleFavorite, t } = baseState;
  const { addItem, isInCart } = useSmartCart();
  const { count: commentsCount } = useCommentsCount('products', product.id, undefined, true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [bestDeal, setBestDeal] = useState<any | null>(null);
  const { formatPrice, convertToPLN } = useCurrency();

  useEffect(() => {
    if (!fetchBestDeal) {
      setBestDeal(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { getBestDealForProduct } = await import('@/lib/data');
        const deal = await getBestDealForProduct(product.id);
        if (!cancelled) setBestDeal(deal || null);
      } catch {
        if (!cancelled) setBestDeal(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchBestDeal, product.id]);

  const productExternalUrl = getExternalUrl(
    product?.affiliateUrl,
    (product as any)?.affiliateLink,
    (product as any)?.link,
    (product as any)?.dealUrl,
    (product as any)?.sourceUrl,
    (product as any)?.url,
    (product as any)?.externalUrl,
    (product as any)?.metadata?.externalUrl,
    (product as any)?.metadata?.url,
    (product as any)?.sourceLinks?.[0]?.url,
    (product as any)?.sourceLinks?.[0]?.link,
    bestDeal?.affiliateLink,
    bestDeal?.affiliateUrl,
    bestDeal?.dealUrl,
    bestDeal?.sourceUrl,
    bestDeal?.link,
    bestDeal?.url,
    bestDeal?.externalUrl,
    bestDeal?.metadata?.offerPreviewUrl,
    bestDeal?.metadata?.offerUrl,
    bestDeal?.metadata?.externalUrl,
    bestDeal?.metadata?.url
  );

  // Format prices using state to fix hydration mismatch
  const [priceData, setPriceData] = useState<{
    formattedPrice: string | null;
    formattedOriginal: string | null;
    formattedShipping: string | null;
    discount: number | null;
    savings: string | null;
  }>({
    formattedPrice: null,
    formattedOriginal: null,
    formattedShipping: null,
    discount: null,
    savings: null,
  });

  // Sync locale when route param changes
  useEffect(() => {
    setLocale(localeFromParams);
  }, [localeFromParams]);

  // Price formatting
  useEffect(() => {
    const isPC = !!(product as any).bestPrice;
    let rawPrice = 0;
    let rawOriginalPrice = 0;
    let rawShipping = 0;
    let sourceCurrency = 'PLN';

    if (isPC) {
      const pc = product as any;
      if (pc.bestPrice) {
        const { amount, currency } = extractPriceInfo(pc.bestPrice);
        rawPrice = amount;
        sourceCurrency = currency;
        
        // Extract shipping cost and original price from bestPrice or logistics
        const bp = pc.bestPrice as any;
        if (bp.shippingCost !== undefined) {
          rawShipping = bp.shippingCost;
        } else if (bp.shipping?.cost !== undefined) {
          rawShipping = bp.shipping.cost;
        } else if (pc.logistics?.shippingCost !== undefined) {
          rawShipping = pc.logistics.shippingCost;
        }
        
        if (bp.originalPrice) rawOriginalPrice = bp.originalPrice;
      }
    } else {
      const { amount, currency } = extractPriceInfo(product.price);
      rawPrice = amount;
      sourceCurrency = currency;
      
      if (typeof product.price === 'object' && product.price !== null) {
        const p = product.price as any;
        if (p.originalPrice) rawOriginalPrice = p.originalPrice;
        const shippingCostVal = p.shipping?.cost !== undefined ? p.shipping.cost : p.shippingCost;
        if (shippingCostVal !== undefined) rawShipping = shippingCostVal;
      }
    }

    const priceInPLN = convertToPLN(rawPrice, sourceCurrency);
    const originalInPLN = convertToPLN(rawOriginalPrice, sourceCurrency);
    const shippingInPLN = convertToPLN(rawShipping, sourceCurrency);

    const formatted = formatPrice(priceInPLN);
    let formattedOrig = '';
    let savings = '';
    let formattedShip = 'Darmowa';

    if (originalInPLN > priceInPLN) {
      formattedOrig = formatPrice(originalInPLN);
      if (priceInPLN > 0) {
        savings = formatPrice(originalInPLN - priceInPLN);
      }
    }

    if (shippingInPLN > 0) {
      formattedShip = formatPrice(shippingInPLN);
    }

    setPriceData({
      formattedPrice: formatted,
      formattedOriginal: formattedOrig,
      formattedShipping: formattedShip,
      discount: (originalInPLN > priceInPLN) ? Math.round(100 - (priceInPLN / originalInPLN) * 100) : null,
      savings,
    });
  }, [product.price, (product as any).bestPrice]);

  const titleText = typeof product.title === 'string' 
    ? product.title 
    : getText(product.title);
  const displayTitle = titleText || product.name || 'Produkt';
  
  // Rating & Stats
  const ratingValue = (product as any).rating;
  const productRating = typeof ratingValue === 'number'
    ? ratingValue
    : (ratingValue?.score ?? (product as any).ratingCard?.average ?? (product as any).ratingSources?.external?.average ?? (product as any).ratingSources?.users?.average ?? 0);
  const merchantRating = (product as any).merchantRating || 0;
  const ratingCount = (product as any).ratingCount
    ?? (ratingValue?.count)
    ?? (product as any).ratingCard?.count
    ?? (product as any).ratingSources?.external?.count
    ?? (product as any).ratingSources?.users?.count
    ?? 0;
  const ordersCount = (product as any).ordersCount || 0;

  // Metadata
  const metadata = product.metadata || {};
  const legacyVariants = (metadata as any).variants || [];
  const m6Variants = (product as any).variants || [];
  const variants = m6Variants.length > 0 ? m6Variants : legacyVariants;
  const specifications = (metadata as any).specifications || [];
  const shippingInfo = (metadata as any).shipping || {};
  const warrantyInfo = (metadata as any).warranty || {};
  const tags = (metadata as any).tags || [];
  const commission = (metadata as any).commission;
  const packageInfo = (metadata as any).package || {};

  const isHotDeal = product.meta?.isHotDeal || tags.includes('hot_deal');
  const isBestsellerTag = tags.includes('bestseller');
  const isNewArrival = tags.includes('new_arrival');
  const hasCoupons = Boolean((product as any).hasCoupons || (product as any).metadata?.hasCoupons);
  const hasVariants = variants.length > 0;
  const inCart = isInCart(product.id);
  const hasRealShipping = shippingInfo.cost !== undefined;

  // View tracking
  useEffect(() => {
    if (!hasTrackedView) {
      void trackFirestoreView('product', product.id, user?.uid);
      setHasTrackedView(true);
    }
  }, [hasTrackedView, product.id, user?.uid]);

  const handleDetailClick = () => {
    void trackFirestoreClick('product', product.id, user?.uid, productExternalUrl || undefined, {
      category: (product as any).mainCategorySlug || (product as any).categorySlug || (product as any).category,
      merchant: (product as any).merchant || (product as any).metadata?.merchant,
      discountPct: priceData.discount ?? undefined,
    });
  };

  const handleShare = (platform?: string) => {
    void trackFirestoreShare('product', product.id, user?.uid, platform);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAddingToCart(true);
    try {
      addItem(product, 1);
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Product URL
  const rawId = product.id || (product as any)._id || (product as any).docId;
  const productId = typeof rawId === 'object' ? String(rawId) : rawId;
  const rawSlug = (product as any).slug;
  const safeSlug = typeof rawSlug === 'string' ? rawSlug : (rawSlug ? getText(rawSlug) : null);
  const productUrl = `${prefix}/new-ux/products/${safeSlug || productId || 'missing-id'}`;
  
  // Resolve images from Product (gallery/image) or ProductCore (images)
  const rawGallery = Array.isArray(product.gallery) ? product.gallery : [];
  const coreImages = Array.isArray((product as any).images) ? (product as any).images : [];
  
  const sanitizeImage = (rawImage: any) => {
    if (typeof rawImage === 'object') {
      rawImage = (rawImage as any).src || (rawImage as any).url || (rawImage as any).imageUrl || '/placeholder.png';
    }
    
    if (typeof rawImage === 'string' && rawImage.startsWith('//')) {
      rawImage = `https:${rawImage}`;
    }
    
    return rawImage;
  };

  // Combine all potential sources
  let allImages: { src: string }[] = [];
  
  if (rawGallery.length > 0) {
    allImages = rawGallery.map(img => ({
      src: sanitizeImage(img),
    })).filter(img => img.src);
  } else if (coreImages.length > 0) {
    allImages = coreImages.map((img: string) => ({ src: sanitizeImage(img) }));
  } else if (typeof product.image === 'string' && product.image) {
    allImages = [{ src: sanitizeImage(product.image) }];
  } else if (typeof (product as any).imageUrl === 'string' && (product as any).imageUrl) {
    allImages = [{ src: sanitizeImage((product as any).imageUrl) }];
  }

  const primaryImageSrc = allImages.length > 0 ? allImages[0].src : '/placeholder.png';
  const galleryImages = allImages;

  // --------------------------------------------------------------------------
  // LIST VIEW (Legacy Layout Preserved)
  // --------------------------------------------------------------------------
  if (viewMode === 'list') {
    return (
      <div className="group relative overflow-hidden rounded-2xl transition-all duration-300 flex flex-col sm:flex-row bg-background/60 backdrop-blur-md p-3 sm:p-4 md:p-5 border border-border/40 items-stretch gap-3 sm:gap-4 md:gap-6 w-full hover:shadow-xl hover:-translate-y-1">
        <Link 
          href={productUrl} 
          onClick={handleDetailClick} 
          className="relative overflow-hidden bg-muted/40 block w-full sm:w-32 md:w-40 h-48 sm:h-24 md:h-32 flex-shrink-0 rounded-xl border border-border/40"
        >
          <ProductGallery images={galleryImages} />
          {/* Trust Badges Overlay */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            {priceData.formattedShipping === null && (
              <Badge className="bg-emerald-500 text-white text-[10px] h-5 px-1.5">
                <Truck className="w-3 h-3 mr-1" />
                Free
              </Badge>
            )}
            {ordersCount > 100 && (
              <Badge className="bg-red-600/90 text-white text-[10px] h-5 px-1.5">
                <Flame className="w-3 h-3 mr-1" />
                {ordersCount > 1000 ? `${(ordersCount/1000).toFixed(1)}k` : ordersCount} kup.
              </Badge>
            )}
          </div>
        </Link>

        {/* Info Column */}
        <div className="flex flex-1 flex-col justify-between gap-2 min-w-0">
          <div>
            <Link href={productUrl} onClick={handleDetailClick}>
              <h3 className="text-lg font-semibold text-primary hover:text-primary transition-colors leading-tight line-clamp-2">
                {displayTitle}
              </h3>
            </Link>
            
            {/* Rating */}
            {productRating > 0 && (
              <div className="flex items-center gap-1 mt-1 text-sm">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-bold">{productRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({ratingCount})</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
               {isHotDeal && <Badge variant="destructive" className="text-[10px]">Hot Deal</Badge>}
               {hasVariants && <Badge variant="outline" className="text-[10px]">{variants.length} wariantów</Badge>}
            </div>
          </div>
        </div>

        {/* Actions Column */}
        <div className="flex flex-col w-full sm:w-48 flex-shrink-0 gap-3 justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-red-600">
                  {priceData.formattedPrice || 'N/A'}
                </span>
                {priceData.formattedOriginal && (
                  <span className="text-sm text-muted-foreground line-through">
                    {priceData.formattedOriginal}
                  </span>
                )}
              </div>
              {priceData.savings && (
                <div className="text-xs text-green-600 font-semibold mt-1">
                  Oszczędzasz {priceData.savings}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-auto">
              {productExternalUrl ? (
                <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold h-9 text-xs shadow-sm">
                  <a href={productExternalUrl} target="_blank" rel="noopener noreferrer">
                    Kup teraz <ExternalLink className="w-3 h-3 ml-2" />
                  </a>
                </Button>
              ) : (
                <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold h-9 text-xs shadow-sm">
                  <Link href={productUrl}>
                    Kup teraz <ExternalLink className="w-3 h-3 ml-2 opacity-70" />
                  </Link>
                </Button>
              )}
              <div className="flex gap-2">
                <Button onClick={handleAddToCart} disabled={isAddingToCart || inCart} className={cn("flex-1 h-12 text-xs", inCart ? "bg-green-500 hover:bg-green-600" : "")} aria-label={inCart ? "W koszyku" : "Dodaj do koszyka"}>
                  {inCart ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12" onClick={(e) => { e.preventDefault(); addToComparison({...product, type: 'product'}); }} aria-label="Dodaj do porównania">
                  <Scale className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-12 w-12" onClick={(e) => { e.preventDefault(); toggleFavorite(); }} aria-label={isFavorited ? "Usuń z ulubionych" : "Dodaj do ulubionych"}>
                  <Heart className={cn("w-4 h-4", isFavorited && "fill-red-500 text-red-500")} />
                </Button>
              </div>
            </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // GRID VIEW (Copied & Adapted from DealCard)
  // --------------------------------------------------------------------------
  const isList = layoutMode === 'list' || viewMode === 'list';
  const isMasonry = layoutMode === 'masonry';

  return (
    <div 
      className={cn(
        "ux-card-container p-4 w-full relative min-w-0 text-left group flex cursor-pointer overflow-hidden",
        isList ? "flex-row items-center gap-6 h-auto" : "flex-col justify-between",
        !isList && !isMasonry ? (details === 'compact' ? "h-[370px]" : "h-[440px]") : "",
        isMasonry ? "h-auto" : "",
        !isList && "max-w-[280px]"
      )}
      onClick={() => {
        router.push(productUrl);
      }}
      role="link"
      tabIndex={0}
    >
      {typeof priceData.discount === 'number' && priceData.discount > 0 && (
        <div className="absolute top-3 left-3 z-30">
          <span className="ux-badge text-white text-[9px] font-black px-2.5 py-1 shadow-md">
            -{priceData.discount}%
          </span>
        </div>
      )}

      {/* Image container with Slide-up Details Overlay (Hover Reveal for Grid/Masonry only) */}
      <div className={cn(
        "ux-image-wrapper relative bg-muted/10 dark:bg-zinc-800/20 shrink-0 flex items-center justify-center overflow-hidden w-full transition-all duration-300",
        isList ? "w-36 h-36" : (details === 'compact' ? "mb-1.5" : "mb-3"),
        !isList && !isMasonry ? (details === 'compact' ? "h-32" : "h-44 aspect-square") : "",
        isMasonry ? "h-64" : ""
      )}>
        {layoutMode === 'masonry' ? (
          <img 
            src={withImageProxy(primaryImageSrc)} 
            alt={displayTitle || 'Produkt'} 
            className="w-full h-full object-cover scale-[1.03] group-hover:scale-105 transition-transform duration-500" 
          />
        ) : (
          <Image 
            src={withImageProxy(primaryImageSrc)} 
            alt={displayTitle || 'Produkt'} 
            fill
            sizes="(max-width: 768px) 100vw, 300px"
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        )}
      </div>

      {/* Text Info Section */}
      <div className={cn(
        "flex-grow min-w-0 pt-1 relative z-10 flex flex-col justify-between",
        isList ? "flex-row items-center gap-6" : 
          (details === 'compact' ? "space-y-1" : "space-y-2.5")
      )}>
        {/* Upper Part: Store name, Title, Specs/Description (Translates upwards on hover to cover image) */}
        <div className={cn(
          "transition-all duration-300 ease-out relative z-10 pb-1 w-full",
          !isList ? "transform group-hover:-translate-y-12" : ""
        )}>
          {/* Absolute background mask that extends downwards without affecting layout height */}
          <div className={cn(
            "absolute inset-0 z-[-1] bg-[var(--ux-image-hover-bg)] backdrop-blur-md transition-all duration-300 rounded-t-lg",
            !isList ? "group-hover:-bottom-12" : ""
          )} />
          <div className={details === 'compact' ? "space-y-1" : "space-y-1.5"}>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{product.merchant || product.source || 'Sklep'}</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/5 text-[10px] font-black text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 transition-colors">
                <span className="text-amber-500">★</span>
                <span>{productRating > 0 ? productRating.toFixed(1) : '4.5'}</span>
                <span className="text-muted-foreground/80 font-medium">({ratingCount || commentsCount || 0})</span>
              </span>
            </div>

            <h4 className="text-xs font-bold line-clamp-2 leading-tight transition-colors group-hover:text-primary">
              {displayTitle}
            </h4>

            {/* List layout extra details reveal on hover */}
            {isList && (
              <div className="max-h-0 opacity-0 overflow-hidden group-hover:max-h-20 group-hover:opacity-100 transition-all duration-300 ease-in-out text-[11px] text-muted-foreground border-t border-border/5 pt-1.5 mt-1">
                <div className="flex flex-wrap gap-2">
                  {specifications && specifications.map((spec: any, idx: number) => (
                    <span key={idx} className="ux-spec-pill px-1.5 py-0.5 text-[9px] font-bold">{spec.name}: {String(spec.value)}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Grid/Masonry Hover Reveal: Specs inside the drawer sliding up */}
            {!isList && (
              <div className="max-h-0 opacity-0 overflow-hidden group-hover:max-h-24 group-hover:opacity-100 transition-all duration-300 ease-in-out text-[10px] text-muted-foreground border-t border-border/5 pt-1.5 mt-1">
                <div className="space-y-1">
                  {specifications && specifications.slice(0, details === 'compact' ? 2 : 4).map((spec: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[9px] pb-0.5">
                      <span className="text-muted-foreground">{spec.name}</span>
                      <span className="font-bold text-foreground">{String(spec.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lower Part: Price & Footer (Always stationary at the bottom, split into right column in List layout) */}
        <div className={cn(
          "bg-[var(--ux-card-bg)] z-20 w-full",
          isList ? "flex flex-col justify-between shrink-0 text-right min-w-[150px] self-stretch pl-4 border-l border-border/10" : 
            (details === 'compact' ? "space-y-1 pt-0.5" : "space-y-2.5 pt-1")
        )}>
          {/* Price & Savings */}
          <div className="space-y-0.5">
            <div className={cn("flex items-baseline gap-2", isList && "justify-end")}>
              <span className="text-xl font-black text-foreground">{priceData.formattedPrice || 'N/A'}</span>
              {priceData.formattedOriginal && (
                <span className="text-xs text-muted-foreground line-through font-bold">{priceData.formattedOriginal}</span>
              )}
            </div>
            {priceData.savings && (
              <div className={cn(
                "text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1.5 leading-none",
                isList && "justify-end"
              )}>
                <span>Zaoszczędź {priceData.savings}</span>
                {typeof priceData.discount === 'number' && priceData.discount > 0 && (
                  <span className="bg-emerald-500/10 px-1 py-0.5 rounded text-[8px] font-black">-{priceData.discount}%</span>
                )}
              </div>
            )}
          </div>

          {/* Footer Section */}
          <div className={cn(
            "flex items-center justify-between w-full",
            isList ? "pt-0 border-t-0 flex-row-reverse items-center justify-end gap-3.5 mt-auto" : 
              (details === 'compact' ? "border-t border-border/10 pt-1.5" : "border-t border-border/10 pt-2")
          )}>
            {/* Left: Star Rating Badge */}
            <div className="flex items-center">
              <span className="flex items-center gap-1 text-[11px] font-extrabold text-foreground px-2 py-0.5 rounded-full border border-border/40 bg-background/50">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                <span>{productRating > 0 ? productRating.toFixed(1) : '4.5'}</span>
              </span>
            </div>

            {/* Right: Actions */}
            <div className={cn(
              "flex items-center gap-1 transition-all duration-300",
              !isList && "translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
            )} onClick={(e) => e.stopPropagation()}>
              <button 
                className={cn("ux-action-btn", isFavorited && "text-red-500 bg-red-500/10 opacity-100")}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(); }}
                disabled={isFavoriteLoading}
                title={isFavorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
              >
                <Heart className={cn("h-3.5 w-3.5", isFavorited && "fill-current")} />
              </button>
              <button 
                className="ux-action-btn"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToComparison({ ...product, type: 'product' }); }}
                title="Porównaj"
              >
                <Scale className="h-3.5 w-3.5" />
              </button>
              <button 
                className={cn("ux-action-btn", inCart && "text-emerald-500 bg-emerald-500/10 opacity-100")}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddToCart(e);
                }}
                disabled={isAddingToCart || inCart}
                title={inCart ? 'W koszyku' : 'Dodaj do koszyka'}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
              </button>
              {productExternalUrl ? (
                <button 
                  className="ux-action-btn bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md opacity-90 hover:opacity-100 hover:scale-110 animate-bounce"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(productExternalUrl, '_blank', 'noopener,noreferrer');
                  }}
                  title="Kup teraz"
                >
                  <ArrowUp className="h-3.5 w-3.5 rotate-90" />
                </button>
              ) : (
                <button 
                  className="ux-action-btn bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md opacity-90 hover:opacity-100 hover:scale-110 animate-bounce"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(productUrl);
                  }}
                  title="Zobacz produkt"
                >
                  <ArrowUp className="h-3.5 w-3.5 rotate-90" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ProductCardMemo = React.memo(
  ProductCard,
  (prevProps, nextProps) => {
    const sameId = prevProps.product?.id === nextProps.product?.id;
    const sameBestPrice = (prevProps.product as any)?.bestPrice === (nextProps.product as any)?.bestPrice;
    const samePrice = (prevProps.product as any)?.price === (nextProps.product as any)?.price;
    const sameView = prevProps.viewMode === nextProps.viewMode;
    const sameDetails = prevProps.showFullDetails === nextProps.showFullDetails;
    return sameId && sameBestPrice && samePrice && sameView && sameDetails;
  }
);

export default ProductCardMemo;
