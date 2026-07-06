// @ts-nocheck
"use client";

import { ProductGallery } from '../product-gallery';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { withImageProxy } from '@/lib/image-proxy';
import { 
  Star, Tag, ExternalLink, Heart, MessageSquare, Truck, Package, 
  Zap, AlertTriangle, ShieldCheck, Info, Share2, ShoppingCart, 
  TrendingDown, Award, Clock, Check, Plus, Eye, Scale, Flame, TrendingUp, Sparkles
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

function ProductCard({ product, showFullDetails = false, viewMode = 'grid', fetchBestDeal = false }: ProductCardProps) {
  const params = useParams();
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
    void trackFirestoreClick('product', product.id, user?.uid);
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
  return (
    <div 
      className="group relative flex h-full flex-col overflow-hidden cursor-pointer rounded-2xl border border-border/30 bg-background/50 backdrop-blur-md shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/20"
      onClick={() => {
        window.location.href = productUrl;
      }}
      role="link"
      tabIndex={0}
    >
      {/* Clean Apple-style Product Image Container */}
      <div className="relative aspect-[4/3] sm:aspect-square bg-muted/5 border-b border-border/20 overflow-hidden transition-all duration-300">
        <Image
          src={withImageProxy(primaryImageSrc)}
          alt={displayTitle || 'Produkt'}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-contain p-6 transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Minimalist Top Bar Overlays */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
          {galleryImages.length > 1 && (
            <span className="bg-background/90 text-foreground text-[10px] font-bold px-2 py-0.5 rounded-md border border-border/20 shadow-sm">
              {galleryImages.length} zdj.
            </span>
          )}
          {typeof priceData.discount === 'number' && priceData.discount > 0 && (
            <span className="bg-green-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
              -{priceData.discount}%
            </span>
          )}
        </div>

        {/* Simple Favorite trigger */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite();
          }}
          disabled={isFavoriteLoading}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 hover:bg-background shadow-sm border border-border/20 transition-all"
          aria-label="Polub"
        >
          <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
        </button>

        {/* Admin actions overlay */}
        <div className="absolute right-3 bottom-3 z-10">
          <AdminQuickActions
            productId={product.id}
            onEdit={() => setEditDialogOpen(true)}
          />
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-grow space-y-2.5 p-4 sm:p-5 min-w-0">
        
        {/* Rating Row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <div className="flex items-center gap-1">
             {productRating > 0 ? (
               <>
                 <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                 <span className="font-bold text-foreground text-xs">{productRating.toFixed(1)}</span>
                 <span className="text-[11px]">({ratingCount})</span>
               </>
             ) : (
               <span className="text-[11px]">Brak ocen</span>
             )}
          </div>
          {merchantRating > 0 && (
            <div className="flex items-center gap-1 font-medium" title="Ocena sprzedawcy">
              <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
              <span className="text-foreground text-xs">{merchantRating.toFixed(0)}%</span>
            </div>
          )}
        </div>

        <h3 className="font-headline text-base sm:text-lg font-bold leading-tight transition-colors group-hover:text-primary line-clamp-2">
          {displayTitle}
        </h3>

        {/* Price Row (Big) */}
        <div className="flex items-baseline gap-2 pt-2 border-t border-border/10 flex-wrap">
          <span className="text-2xl font-black text-foreground tracking-tight">
            {priceData.formattedPrice || 'N/A'}
          </span>
          {priceData.formattedOriginal && (
             <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/50">
               {priceData.formattedOriginal}
             </span>
          )}
          {priceData.savings && (
            <span className="ml-auto text-xs font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/10">
              Oszczędzasz {priceData.savings}
            </span>
          )}
        </div>

        {/* Info/Tags Row */}
        <div className="flex flex-wrap gap-1.5 pt-1">
           {packageInfo?.weight && (
             <Badge variant="outline" className="text-[10px] font-medium border-border/80 bg-background/50">
               <Package className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
               {packageInfo.weight}kg
             </Badge>
           )}
           {hasVariants && (
             <Badge variant="outline" className="text-[10px] font-medium border-border/80 bg-background/50">
               {variants.length} wariantów
             </Badge>
           )}
           {warrantyInfo?.available && (
              <Badge variant="outline" className="text-[10px] font-medium border-border/80 bg-background/50">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                Gwarancja
              </Badge>
           )}
        </div>

      </div>

      {/* Footer Actions */}
      <div className="flex flex-col gap-2 border-t bg-muted/30 p-3 mt-auto">
        {/* Main Action: Buy Now */}
        {productExternalUrl ? (
          <Button
            asChild
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm h-10 shadow-sm hover:shadow-md transition-all duration-300"
          >

            <a 
              href={productExternalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                trackFirestoreClick(product.id, 'product', 'buy_now_button');
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Kup teraz
            </a>
          </Button>
        ) : (
          <Button
            asChild
            className="w-full bg-emerald-600 text-white font-bold text-sm h-9 shadow-sm"
          >
            <Link href={productUrl}>
              <ExternalLink className="w-4 h-4 mr-2 opacity-70" />
              Kup teraz
            </Link>
          </Button>
        )}

        {/* Secondary Actions Row - Icon Only */}
        <div className="flex gap-1.5 justify-center">
          <Button
            onClick={handleAddToCart}
            disabled={isAddingToCart || inCart}
            variant={inCart ? "default" : "outline"}
            size="icon"
            className={cn(
              "h-8 w-8 transition-all",
              inCart && "bg-green-600 hover:bg-green-700 text-white"
            )}
            title={inCart ? t('cart.inCart') : t('cart.addToCart')}
          >
            {isAddingToCart ? (
               <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-current border-t-transparent" />
            ) : inCart ? (
               <Check className="w-4 h-4" />
             ) : (
               <ShoppingCart className="w-4 h-4" />
            )}
          </Button>

          <Button 
            variant={isFavorited ? "default" : "outline"}
            size="icon"
            className={cn("h-8 w-8", isFavorited && "bg-red-500 hover:bg-red-600")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite();
            }}
            title={isFavorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            <Heart className={cn("w-4 h-4", isFavorited && "fill-current")} />
          </Button>

          <Button 
            variant="outline" 
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToComparison({...product, type: 'product'});
            }}
            aria-label="Porównaj"
          >
            <Scale className="w-4 h-4" />
          </Button>

          <ShareButton 
            type="product" 
            itemId={product.id} 
            title={displayTitle} 
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}${productUrl}`}
            variant="outline" 
            size="icon"
            onShared={(platform) => handleShare(platform)} 
          />
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
