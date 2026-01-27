// @ts-nocheck
"use client";

import { ProductGallery } from './product-gallery';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { 
  Star, Tag, ExternalLink, Heart, MessageSquare, Truck, Package, 
  Zap, AlertTriangle, ShieldCheck, Info, Share2, ShoppingCart, 
  TrendingDown, Award, Clock, Check, Plus, Eye, Scale, Flame, TrendingUp, Sparkles
} from 'lucide-react';
import { RatingBar } from './rating-bar';
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
import { useFavorites } from '@/hooks/use-favorites';
import ShareButton from '@/components/share-button';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { trackFirestoreView, trackFirestoreClick, trackFirestoreShare } from '@/lib/analytics';
import { AdminQuickActions } from '@/components/admin/admin-quick-actions';
// import ProductEditDialog from '@/components/admin/product-edit-dialog';
import { useContentLanguage } from '@/hooks/use-content-language';
import { useSmartCart } from '@/lib/cart-context';
import { useCurrency, CurrencyManager } from '@/lib/unified-currency';
import { 
  extractPriceInfo, 
  getDiscountPercent 
} from '@/lib/i18n-utils';
import { cn } from '@/lib/utils';
import { useComparison } from '@/components/deal-comparison-tool';

interface ProductCardProps {
  product: Product;
  showFullDetails?: boolean;
  viewMode?: 'list' | 'grid';
}

const safeText = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

export default function ProductCard({ product, showFullDetails = false, viewMode = 'grid' }: ProductCardProps) {
  const t = useTranslations('common');
  const params = useParams();
  const localeFromParams = (params?.locale as string) || 'pl';
  const [locale, setLocale] = useState(() => localeFromParams);
  const prefix = `/${locale}`;
  const { getText } = useContentLanguage();
  const { addItem, isInCart } = useSmartCart();
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(product.id, 'product');
  const { user } = useAuth();
  const { count: commentsCount } = useCommentsCount('products', product.id);
  const { addToComparison } = useComparison();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { currency } = useCurrency();
  const [isMounted, setIsMounted] = useState(false);

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

  // Hydration safety
  useEffect(() => {
    setIsMounted(true);
    setLocale(localeFromParams);
  }, [localeFromParams]);

  // Price formatting
  useEffect(() => {
    if (!isMounted) return;
    const userCurrency = currency || 'PLN';
    
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
      }
    } else {
      const { amount, currency } = extractPriceInfo(product.price);
      rawPrice = amount;
      sourceCurrency = currency;
      
      if (typeof product.price === 'object' && product.price !== null) {
        const p = product.price as any;
        if (p.originalPrice) rawOriginalPrice = p.originalPrice;
        if (p.shippingCost) rawShipping = p.shippingCost;
      }
    }

    const priceInPLN = CurrencyManager.convertToPLN(rawPrice, sourceCurrency);
    const originalInPLN = CurrencyManager.convertToPLN(rawOriginalPrice, sourceCurrency);
    const shippingInPLN = CurrencyManager.convertToPLN(rawShipping, sourceCurrency);

    const formatted = CurrencyManager.formatPrice(priceInPLN, userCurrency);
    let formattedOrig: string | null = null;
    let calculatedDiscount: number | null = null;
    let formattedShip: string | null = null;
    let savings: string | null = null;

    if (rawOriginalPrice > 0) {
      formattedOrig = CurrencyManager.formatPrice(originalInPLN, userCurrency);
      if (originalInPLN > priceInPLN) {
        calculatedDiscount = Math.round(100 - (priceInPLN / originalInPLN) * 100);
        savings = CurrencyManager.formatPrice(originalInPLN - priceInPLN, userCurrency);
      }
    }

    if (rawShipping > 0) {
      formattedShip = CurrencyManager.formatPrice(shippingInPLN, userCurrency);
    }

    setPriceData({
      formattedPrice: formatted,
      formattedOriginal: formattedOrig,
      formattedShipping: formattedShip,
      discount: calculatedDiscount,
      savings,
    });
  }, [isMounted, currency, product.price, (product as any).bestPrice]);

  const titleText = typeof product.title === 'string' 
    ? product.title 
    : getText(product.title);
  const displayTitle = titleText || product.name || 'Produkt';
  
  // Rating & Stats
  const productRating = (product as any).rating || 0;
  const merchantRating = (product as any).merchantRating || 0;
  const ratingCount = (product as any).ratingCount || 0;
  const ordersCount = (product as any).ordersCount || 0;

  // Metadata
  const metadata = product.metadata || {};
  const variants = (metadata as any).variants || [];
  const specifications = (metadata as any).specifications || [];
  const shippingInfo = (metadata as any).shipping || {};
  const warrantyInfo = (metadata as any).warranty || {};
  const tags = (metadata as any).tags || [];
  const commission = (metadata as any).commission;
  const packageInfo = (metadata as any).package || {};

  const isHotDeal = product.meta?.isHotDeal || tags.includes('hot_deal');
  const isBestsellerTag = tags.includes('bestseller');
  const isNewArrival = tags.includes('new_arrival');
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
  const productId = product.id || (product as any)._id || (product as any).docId;
  const productUrl = `${prefix}/products/${(product as any).slug || productId || 'missing-id'}`;
  
  // Resolve images from Product (gallery/image) or ProductCore (images)
  const rawGallery = Array.isArray(product.gallery) ? product.gallery : [];
  const coreImages = Array.isArray((product as any).images) ? (product as any).images : [];
  
  // Combine all potential sources
  let allImages: { src: string }[] = [];
  
  if (rawGallery.length > 0) {
    allImages = rawGallery.map(img => ({
      src: typeof img === 'string' ? img : img.src,
    }));
  } else if (coreImages.length > 0) {
    allImages = coreImages.map((img: string) => ({ src: img }));
  } else if (typeof product.image === 'string' && product.image) {
    allImages = [{ src: product.image }];
  }

  const primaryImageSrc = allImages.length > 0 ? allImages[0].src : '/placeholder.png';
  const galleryImages = allImages;

  // --------------------------------------------------------------------------
  // LIST VIEW (Legacy Layout Preserved)
  // --------------------------------------------------------------------------
  if (viewMode === 'list') {
    return (
      <div className="group relative overflow-hidden rounded-lg transition-all duration-300 flex flex-col sm:flex-row bg-card p-3 sm:p-4 md:p-5 border items-stretch gap-3 sm:gap-4 md:gap-6 w-full hover:shadow-lg hover:-translate-y-0.5">
        <Link 
          href={productUrl} 
          onClick={handleDetailClick} 
          className="relative overflow-hidden bg-muted block w-full sm:w-32 md:w-40 h-48 sm:h-24 md:h-32 flex-shrink-0 rounded-md"
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
              <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold h-9 text-xs shadow-sm">
                <a href={product.affiliateUrl} target="_blank" rel="noopener noreferrer">
                  Kup teraz <ExternalLink className="w-3 h-3 ml-2" />
                </a>
              </Button>
              <div className="flex gap-2">
                <Button onClick={handleAddToCart} disabled={isAddingToCart || inCart} className={cn("flex-1 h-8 text-xs", inCart ? "bg-green-500 hover:bg-green-600" : "")}>
                  {inCart ? <Check className="w-3 h-3" /> : <ShoppingCart className="w-3 h-3" />}
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.preventDefault(); addToComparison({...product, type: 'product'}); }}>
                  <Scale className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={(e) => { e.preventDefault(); toggleFavorite(); }}>
                  <Heart className={cn("w-3 h-3", isFavorited && "fill-red-500 text-red-500")} />
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
      className="card-interactive group flex h-full flex-col overflow-hidden cursor-pointer"
      onClick={() => {
        window.location.href = productUrl;
      }}
      role="link"
      tabIndex={0}
    >
      <div className="relative overflow-hidden aspect-square bg-muted">
        {/* Gallery / Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src={primaryImageSrc}
            alt={displayTitle || 'Produkt'}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain transition-transform-base group-hover:scale-105 p-4"
          />
        </div>

        {/* Favorite Button (Left Top) */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-2 top-2 h-8 w-8 rounded-full bg-white/90 shadow-md hover:bg-white transition-all-fast z-10 btn-icon-hover"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite();
          }}
          disabled={isFavoriteLoading}
        >
          <Heart
            className={`h-4 w-4 md:h-5 md:w-5 btn-favorite ${
              isFavorited ? 'btn-favorite-active' : ''
            }`}
          />
        </Button>

        {/* Badges Column (Right Top) */}
        <div className="absolute right-2 top-2 flex flex-col space-sm z-10 gap-1 items-end">
          {/* Social Proof */}
          {ordersCount > 10 && (
            <div className="bg-red-600/90 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm flex items-center gap-1 shadow-sm">
               <Flame className="w-3 h-3" />
               <span className="font-medium">
                 {ordersCount > 1000 ? `${(ordersCount/1000).toFixed(1)}k` : ordersCount} kup.
               </span>
            </div>
          )}
          
          {/* Hot Deal */}
          {isHotDeal && (
            <Badge variant="destructive" className="shadow-md">
              <Zap className="mr-1 h-3 w-3" />
              Hot Deal
            </Badge>
          )}

          {/* Discount */}
          {typeof priceData.discount === 'number' && priceData.discount > 0 && (
            <Badge className="badge-hot badge-trust text-sm font-bold shadow-md">
              <TrendingDown className="w-3 h-3 mr-1" />
              -{priceData.discount}%
            </Badge>
          )}

          {isBestsellerTag && (
            <Badge className="bg-purple-500 text-white shadow-md">
              <TrendingUp className="mr-1 h-3 w-3" />
              Bestseller
            </Badge>
          )}
          
          {isNewArrival && (
            <Badge className="bg-blue-500 text-white shadow-md">
              <Sparkles className="mr-1 h-3 w-3" />
              Nowość
            </Badge>
          )}

          {priceData.formattedShipping === null && (
            <Badge className="bg-emerald-500 text-white badge-trust shadow-md">
              <Truck className="mr-1 h-3 w-3" />
              Free
            </Badge>
          )}
        </div>

        {/* Admin Quick Actions */}
        <div className="absolute right-2 bottom-2 z-10">
          <AdminQuickActions
            productId={product.id}
            onEdit={() => setEditDialogOpen(true)}
            className=""
          />
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-grow space-y-2 sm:space-y-3 p-3 sm:p-4 md:p-5 min-w-0">
        
        {/* Rating Row (Instead of Breadcrumb/Time in DealCard) */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <div className="flex items-center gap-1">
             {productRating > 0 ? (
               <>
                 <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                 <span className="font-semibold text-foreground">{productRating.toFixed(1)}</span>
                 <span>({ratingCount})</span>
               </>
             ) : (
               <span>Brak ocen</span>
             )}
          </div>
          {merchantRating > 0 && (
            <div className="flex items-center gap-1" title="Ocena sprzedawcy">
              <ShieldCheck className="w-3 h-3 text-green-600" />
              <span>{merchantRating.toFixed(0)}%</span>
            </div>
          )}
        </div>

        <h3 className="font-headline text-sm sm:text-base md:text-lg font-semibold leading-tight transition-colors group-hover:text-primary line-clamp-2">
          {displayTitle}
        </h3>

        {/* Price Row (Big) */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
          <span className="text-lg sm:text-xl md:text-2xl font-bold text-primary">
            {priceData.formattedPrice || 'N/A'}
          </span>
          {priceData.formattedOriginal && (
             <span className="text-xs sm:text-sm text-muted-foreground line-through">
               {priceData.formattedOriginal}
             </span>
          )}
          {priceData.savings && (
            <span className="ml-auto text-xs font-semibold text-green-600">
              Oszczędzasz {priceData.savings}
            </span>
          )}
        </div>

        {/* Info/Tags Row */}
        <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs text-muted-foreground mt-2">
           {packageInfo?.weight && (
             <Badge variant="outline" className="text-[10px] h-5 px-1.5">
               <Package className="w-3 h-3 mr-1" />
               {packageInfo.weight}kg
             </Badge>
           )}
           {hasVariants && (
             <Badge variant="outline" className="text-[10px] h-5 px-1.5">
               {variants.length} wariantów
             </Badge>
           )}
           {warrantyInfo?.available && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Gwarancja
              </Badge>
           )}
        </div>

      </div>

      {/* Footer Actions (Matching DealCard style) */}
      <div className="flex flex-col gap-2 border-t bg-muted/30 p-2 sm:p-3">
        {/* Main Action: Buy Now */}
        <Button
          asChild
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-sm h-9 shadow-sm hover:shadow-md transition-all"
        >
          <a 
            href={product.affiliateUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              trackFirestoreClick(product.id, 'product', 'buy_now_button');
            }}
          >
            🚀 Kup teraz
            <ExternalLink className="w-3 h-3 ml-2" />
          </a>
        </Button>

        {/* Secondary Actions Row */}
        <div className="flex gap-2">
          <Button
            onClick={handleAddToCart}
            disabled={isAddingToCart || inCart}
            variant={inCart ? "default" : "outline"}
            className={cn(
              "flex-1 font-semibold transition-all h-8 text-xs border-input bg-background hover:bg-accent hover:text-accent-foreground",
              inCart && "bg-green-600 hover:bg-green-700 text-white border-green-600"
            )}
            size="sm"
          >
            {isAddingToCart ? (
               <span className="flex items-center"><div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent mr-2" /> Dodaję</span>
            ) : inCart ? (
               <span className="flex items-center"><Check className="w-3 h-3 mr-1" /> {t('cart.inCart')}</span>
             ) : (
               <span className="flex items-center"><ShoppingCart className="w-3 h-3 mr-1" /> {t('cart.addToCart')}</span>
            )}
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToComparison({...product, type: 'product'});
            }}
            title="Porównaj"
          >
            <Scale className="w-3.5 h-3.5" />
          </Button>

          <ShareButton 
            type="product" 
            itemId={product.id} 
            title={displayTitle} 
            url={`${typeof window !== 'undefined' ? window.location.origin : ''}${productUrl}`}
            variant="outline" 
            size="sm"
            className="h-8 w-8 px-0" 
            onShared={(platform) => handleShare(platform)} 
          />
        </div>
      </div>
    </div>
  );
}
