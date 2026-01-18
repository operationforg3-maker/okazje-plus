// @ts-nocheck
"use client";

import { ProductGallery } from './product-gallery';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Star, Tag, ExternalLink, Heart, MessageSquare, Truck, Package, 
  Zap, AlertTriangle, ShieldCheck, Info, Share2, ShoppingCart, 
  TrendingDown, Award, Clock, Check, Plus, Eye, Scale
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
import AdminEditButton from '@/components/admin/admin-edit-button';
import ProductEditDialog from '@/components/admin/product-edit-dialog';
import { useContentLanguage } from '@/hooks/use-content-language';
import { useSmartCart } from '@/lib/cart-context';
import { useCurrency, CurrencyManager } from '@/lib/unified-currency';
import { 
  getPriceAmount, 
  getTotalPrice, 
  isFreeShipping,
  getDiscountPercent,
  extractPriceInfo 
} from '@/lib/i18n-utils';
import { cn } from '@/lib/utils';
import { useComparison } from '@/components/deal-comparison-tool';

interface ProductCardProps {
  product: Product;
  showFullDetails?: boolean;
  viewMode?: 'list' | 'grid';
}

export default function ProductCard({ product, showFullDetails = false, viewMode = 'grid' }: ProductCardProps) {
  const params = useParams();
  const localeFromParams = (params?.locale as string) || 'pl';
  const [locale, setLocale] = useState(() => localeFromParams);
  const prefix = `/${locale}`;
  const { getText } = useContentLanguage();
  const { addItem, isInCart } = useSmartCart();
  const { isFavorited, isLoading, toggleFavorite } = useFavorites(product.id, 'product');
  const { user } = useAuth();
  const { count: commentsCount } = useCommentsCount('products', product.id);
  const { addToComparison } = useComparison();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { currency } = useCurrency();
  const [isMounted, setIsMounted] = useState(false);

  // Format prices using state to fix hydration mismatch (SAME PATTERN AS DEALCARD)
  const [priceData, setPriceData] = useState<{
    formattedPrice: string | null;
    formattedOriginal: string | null;
    formattedShipping: string | null;
    discount: number | null;
  }>({
    formattedPrice: null,
    formattedOriginal: null,
    formattedShipping: null,
    discount: null,
  });

  // Hydration safety - sync locale on mount
  useEffect(() => {
    setIsMounted(true);
    setLocale(localeFromParams);
  }, [localeFromParams]);

  // Format prices on client only (using unified currency system) - M6 Currency Aware
  useEffect(() => {
    if (!isMounted) return;
    const userCurrency = currency || 'PLN';
    
    // Detect data model (ProductCore M6 vs Legacy Product)
    const isPC = !!(product as any).bestPrice;
    
    // Extract base values and source currency
    let rawPrice = 0;
    let rawOriginalPrice = 0;
    let rawShipping = 0;
    let sourceCurrency = 'PLN';

    if (isPC) {
      // M6 ProductCore
      const pc = product as any;
      if (pc.bestPrice) {
        // Robust extraction for ProductCore bestPrice
        const { amount, currency } = extractPriceInfo(pc.bestPrice);
        rawPrice = amount;
        sourceCurrency = currency;
      }
      // ProductCore doesn't typically store originalPrice/shipping in top-level bestPrice
    } else {
      // Legacy Product / Hybrid
      // Use extractPriceInfo for potential M6-style price object in legacy field
      const { amount, currency } = extractPriceInfo(product.price);
      rawPrice = amount;
      sourceCurrency = currency;
      
      // Try to detect other fields from legacy price object if available
      if (typeof product.price === 'object' && product.price !== null) {
        const p = product.price as any;
        if (p.originalPrice) rawOriginalPrice = p.originalPrice;
        if (p.shippingCost) rawShipping = p.shippingCost;
      }
    }

    // Convert to PLN (Base) then to User Currency
    const priceInPLN = CurrencyManager.convertToPLN(rawPrice, sourceCurrency);
    const originalInPLN = CurrencyManager.convertToPLN(rawOriginalPrice, sourceCurrency);
    const shippingInPLN = CurrencyManager.convertToPLN(rawShipping, sourceCurrency);

    // Format for display
    const formatted = CurrencyManager.formatPrice(priceInPLN, userCurrency);
    let formattedOrig: string | null = null;
    let calculatedDiscount: number | null = null;
    let formattedShip: string | null = null;

    if (rawOriginalPrice > 0) {
      formattedOrig = CurrencyManager.formatPrice(originalInPLN, userCurrency);
      if (originalInPLN > priceInPLN) {
        calculatedDiscount = Math.round(100 - (priceInPLN / originalInPLN) * 100);
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
    });
  }, [isMounted, currency, product.price, (product as any).bestPrice]);

  const titleText = typeof product.title === 'string' 
    ? product.title 
    : getText(product.title);
  const displayTitle = titleText || product.name || 'Produkt';
  
  // Currency detection
  const productCurrency = typeof product.price === 'object' && 'currency' in product.price 
    ? product.price.currency 
    : 'PLN';

  // Rating data with safeguards
  const productRating = (product as any).rating || 0;
  const merchantRating = (product as any).merchantRating || 0;
  const ratingCount = (product as any).ratingCount || 0;
  const ordersCount = (product as any).ordersCount || 0;

  // Trust indicators
  const isVerifiedMerchant = merchantRating >= 95;
  const isBestseller = ordersCount > 1000;
  const hasFastShipping = (product as any).shippingMethod === 'express' || ((product as any).estimatedDeliveryDays && (product as any).estimatedDeliveryDays <= 7);
  
  // AI Quality Score
  const aiScore = product.aiContent?.score || 0;
  const isAIRecommended = aiScore > 80;
  
  // Hot Deal indicator
  const isHotDeal = product.meta?.isHotDeal || false;
  const salesVolume = product.meta?.salesVolume || 0;
  const inCart = isInCart(product.id);

  const metadata = product.metadata || {};
  const variants = (metadata as any).variants || [];
  const specifications = (metadata as any).specifications || [];
  const shippingInfo = (metadata as any).shipping || {};
  const packageInfo = (metadata as any).package || {};
  const warrantyInfo = (metadata as any).warranty || {};
  const tags = (metadata as any).tags || [];
  const commission = (metadata as any).commission;
  const stats = (metadata as any).stats || {};
  const source = metadata.source || 'manual';

  const shippingOrigin = (shippingInfo.origin || shippingInfo.warehouse || (product as any).warehouse || (product as any).shippingFrom || '') as string;
  const normalizedOrigin = typeof shippingOrigin === 'string' ? shippingOrigin.toLowerCase() : '';
  const shipsFromEU = normalizedOrigin
    ? ['poland','polska','germany','deutsch','spain','france','italy','europe','eu','netherlands','czech','austria','belgium','sweden','portugal','lithuania','latvia'].some((hint) => normalizedOrigin.includes(hint))
    : false;
  const originBadgeLabel = shippingOrigin || (shipsFromEU ? 'Magazyn EU' : '');
  
  const isHotDealTag = tags.includes('hot_deal');
  const isBestsellerTag = tags.includes('bestseller');
  const isNewArrival = tags.includes('new_arrival');
  const isPolishMarket = tags.includes('polish_market');
  const hasRealShipping = shippingInfo.cost !== undefined;
  const hasVariants = variants.length > 0;
  const hasSpecs = specifications.length > 0;

  // ========================================
  // 💡 ANALYTICS & LIFECYCLE
  // ========================================
  
  useEffect(() => {
    if (!hasTrackedView) {
      void trackFirestoreView('product', product.id, user?.uid);
      setHasTrackedView(true);
    }
  }, [hasTrackedView, product.id, user?.uid]);

  const totalUSD = (product.price?.baseAmount || 0) + (product.price?.shippingCostUSD || 0);

  const originalAmount = typeof product.price === 'object' && 'originalAmount' in product.price
    ? (product.price as any).originalAmount
    : null;
  const discountPercent = product.price ? getDiscountPercent(product.price) : 0;
  const hasDiscount = Boolean(discountPercent && Number.isFinite(discountPercent) && discountPercent > 0);

  const handleDetailClick = () => {
    void trackFirestoreClick('product', product.id, user?.uid);
  };

  const handleAffiliateClick = () => {
    void trackFirestoreClick('product', product.id, user?.uid);
  };

  const handleShare = () => {
    void trackFirestoreShare('product', product.id, user?.uid);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAddingToCart(true);
    try {
      addItem(product, 1);
      // Visual feedback delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Product URL - ensure we have valid ID
  const productId = product.id || (product as any)._id || (product as any).docId;
  if (!productId) {
    console.error('[ProductCard] Product missing ID:', {
      product,
      keys: Object.keys(product),
      id: product.id,
      hasId: 'id' in product,
    });
  }
  const productUrl = `${prefix}/products/${(product as any).slug || productId || 'missing-id'}`;
  
  if (!productId || productId === 'missing-id') {
    console.warn('[ProductCard] Invalid product URL generated:', productUrl, 'for product:', product);
  }

  // Gallery setup
  const galleryImages = Array.isArray(product.gallery) && product.gallery.length > 0
    ? product.gallery.map(img => ({
        src: typeof img === 'string' ? img : img.src,
      }))
    : [];
  // Elementy JSX (tytuł, cena, dostawa) renderowane poniżej, nie w galleryImages
  // ========================================
  
  return (
    <>
      <div className={cn(
        "card-interactive group relative overflow-hidden bg-surface border-2 border-default hover:border-primary/50 rounded-lg shadow-md hover:shadow-lg transition-all-base",
        viewMode === 'list' ? "flex flex-row space-lg p-card" : "flex flex-col"
      )}>
        
        {/* Admin Edit Button (Top-right overlay) */}
        {user?.role === 'admin' && (
          <div className="absolute top-2 right-2 z-20">
            <AdminEditButton
              onClick={() => setEditDialogOpen(true)}
              variant="ghost"
              size="sm"
              className="bg-surface/95 backdrop-blur-sm hover:bg-surface-hover border border-default"
            />
          </div>
        )}

        {/* Product Gallery */}
        <Link 
          href={productUrl} 
          onClick={handleDetailClick} 
          className={cn(
            "relative block",
            viewMode === 'list' ? "w-48 flex-shrink-0" : "w-full"
          )}
        >
          <ProductGallery images={galleryImages} />
          
          {/* Trust Badges Overlay (Top-left) */}
          <div className="absolute top-3 left-3 flex flex-col space-sm z-10">
            {priceData.formattedShipping === null && (
              <Badge className="bg-emerald-500 text-white badge-trust">
                <Truck className="w-3 h-3 mr-1" />
                Darmowa dostawa
              </Badge>
            )}
            
            {false && (
              <Badge className="bg-blue-500 text-white badge-trust">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Gwarancja ceny
              </Badge>
            )}
            
            {hasFastShipping && (
              <Badge className="bg-amber-500 text-white badge-trust">
                <Zap className="w-3 h-3 mr-1" />
                Szybka dostawa
              </Badge>
            )}

            {shipsFromEU && (
              <Badge className="bg-emerald-600 text-white badge-trust">
                <Truck className="w-3 h-3 mr-1" />
                Wysyłka z Europy
              </Badge>
            )}

            {!shipsFromEU && originBadgeLabel && (
              <Badge variant="secondary" className="badge-trust">
                <Package className="w-3 h-3 mr-1" />
                {originBadgeLabel}
              </Badge>
            )}
            
            {isVerifiedMerchant && (
              <Badge className="bg-indigo-500 text-white badge-trust">
                <Award className="w-3 h-3 mr-1" />
                Zweryfikowany
              </Badge>
            )}
            
            {/* AI Quality Badge */}
            {isAIRecommended && (
              <Badge className="bg-purple-500 text-white badge-trust">
                <Zap className="w-3 h-3 mr-1" />
                AI Rekomenduje
              </Badge>
            )}
            
            {/* Hot Deal Badge */}
            {isHotDeal && (
              <Badge className="bg-red-500 text-white badge-trust animate-pulse">
                <Zap className="w-3 h-3 mr-1" />
                HOT DEAL
              </Badge>
            )}
          </div>

          {/* Discount Badge (Top-right corner) */}
          {discountPercent && discountPercent > 0 && (
            <div className="absolute top-3 right-3 z-10">
              <Badge className="badge-hot badge-trust text-base font-bold px-3 py-1.5">
                <TrendingDown className="w-4 h-4 mr-1" />
                -{discountPercent}%
              </Badge>
            </div>
          )}
        </Link>

        {/* Content Area */}
        <div className={cn(
          "flex flex-1",
          viewMode === 'list' ? "flex-row gap-6 py-2" : "flex-col space-y-4 p-5"
        )}>
          
          {/* Left Column: Info */}
          <div className={cn(
            "flex flex-col",
            viewMode === 'list' ? "flex-1 space-y-3" : "space-y-4"
          )}>
          
          {/* Title (AI-Curated Clean Title) */}
          <Link href={productUrl} onClick={handleDetailClick}>
            <h3 className={cn(
              "text-base font-semibold text-primary hover:text-primary transition-colors leading-snug",
              viewMode === 'list' ? "line-clamp-2 text-lg" : "line-clamp-2"
            )}>
              {product.title?.pl || product.title?.en || product.title?.de || product.name || 'Produkt'}
            </h3>
          </Link>

          {/* Enhanced Tags Row */}
          {(isHotDeal || isBestsellerTag || isNewArrival || hasVariants || hasRealShipping) && (
            <div className="flex flex-wrap space-sm">
              {isHotDeal && (
                <Badge variant="destructive" className="text-xs font-semibold px-2.5 py-0.5">
                  <Flame className="w-3 h-3 mr-1" />
                  Hot Deal
                </Badge>
              )}
              {isBestsellerTag && (
                <Badge variant="default" className="text-xs font-semibold px-2.5 py-0.5">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Bestseller
                </Badge>
              )}
              {isNewArrival && (
                <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Nowość
                </Badge>
              )}
              {hasVariants && (
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                  {variants.length} wariantów
                </Badge>
              )}
              {hasRealShipping && shippingInfo.cost > 0 && (
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                  <Truck className="w-3 h-3 mr-1" />
                  {shippingInfo.cost} PLN
                </Badge>
              )}
            </div>
          )}

          {/* Rating & Social Proof */}
          {productRating > 0 && (
            <div className="flex items-center space-md flex-wrap">
              <div className="flex items-center space-sm">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-base font-bold text-primary">
                  {Number.isFinite(productRating) ? productRating.toFixed(1) : '—'}
                </span>
              </div>
              
              {ratingCount > 0 && (
                <span className="text-sm text-secondary font-medium">
                  ({ratingCount.toLocaleString()} ocen)
                </span>
              )}

              {ordersCount > 0 && (
                <>
                  <span className="text-tertiary">•</span>
                  <span className="text-sm text-secondary font-medium">
                    {ordersCount.toLocaleString()} zamówień
                  </span>
                </>
              )}

              {commentsCount > 0 && (
                <>
                  <span className="text-tertiary">•</span>
                  <span className="text-sm text-secondary flex items-center space-sm font-medium">
                    <MessageSquare className="w-4 h-4" />
                    {commentsCount} opinii
                  </span>
                </>
              )}
              
              {/* Sales Volume (from AliExpress) */}
              {salesVolume > 0 && (
                <>
                  <span className="text-tertiary">•</span>
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center space-sm font-semibold">
                    <TrendingDown className="w-4 h-4" />
                    {salesVolume.toLocaleString()} sprzedanych
                  </span>
                </>
              )}
            </div>
          )}

          {/* Enhanced Metadata Chips */}
          {showFullDetails && (hasSpecs || warrantyInfo.available || packageInfo.weight) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {hasSpecs && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="cursor-help">
                        <Info className="w-3 h-3 mr-1" />
                        {specifications.length} specyfikacji
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1 text-xs">
                        {specifications.slice(0, 3).map((spec: any, idx: number) => (
                          <div key={idx}>
                            <span className="font-medium">{spec.name}:</span> {spec.value}
                          </div>
                        ))}
                        {specifications.length > 3 && (
                          <div className="text-muted-foreground">+{specifications.length - 3} więcej...</div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {warrantyInfo.available && (
                <Badge variant="outline">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Gwarancja
                </Badge>
              )}
              {packageInfo.weight && (
                <Badge variant="outline">
                  <Package className="w-3 h-3 mr-1" />
                  {packageInfo.weight}kg
                </Badge>
              )}
              {shippingInfo.estimatedDays && (
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  ~{shippingInfo.estimatedDays} dni
                </Badge>
              )}
            </div>
          )}

          {/* Commission Badge (for affiliates/admins) */}
          {showFullDetails && commission && user?.role === 'admin' && (
            <Badge variant="secondary" className="text-xs">
              💰 Prowizja: {commission}%
            </Badge>
          )}

          {viewMode !== 'list' && (
            <>
              {/* Feature badges to highlight available actions */}
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Badge variant="outline" className="gap-1 border-strong bg-surface-hover">
              <Scale className="w-3 h-3" />
              Porównaj
            </Badge>
            <Badge variant="outline" className="gap-1 border-strong bg-surface-hover">
              <ShoppingCart className="w-3 h-3" />
              Wspólny koszyk
            </Badge>
            <Badge variant="outline" className="gap-1 border-strong bg-surface-hover">
              <Heart className="w-3 h-3" />
              Ulubione
            </Badge>
                <Badge variant="outline" className="gap-1 border-strong bg-surface-hover">
                  <MessageSquare className="w-3 h-3" />
                  Opinie
                </Badge>
              </div>
            </>
          )}
          
          </div>
          
          {/* Right Column: Price & Actions */}
          <div className={cn(
            "flex flex-col",
            viewMode === 'list' ? "w-96 flex-shrink-0 space-y-3 justify-between" : "space-y-4"
          )}>

          {/* ========================================
              💎 TOTAL LANDED COST (Trust-First Hero)
              ======================================== */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-md p-comfortable border-2 border-primary/30 shadow-sm">

            <div className="flex flex-wrap items-center justify-between space-md text-sm text-secondary mb-4">
              <div className="flex items-center space-sm">
                {hasDiscount && (
                  <Badge className="badge-hot badge-trust px-3 py-1.5 text-sm font-bold">
                    <TrendingDown className="w-4 h-4 mr-1" />
                    -{discountPercent}%
                  </Badge>
                )}
                {originalAmount && (
                  <span className="line-through text-base font-medium">
                    {CurrencyManager.formatPrice(originalAmount, currency)}
                  </span>
                )}
              </div>

              {shipsFromEU ? (
                <div className="flex items-center space-sm text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                  <Truck className="w-4 h-4" />
                  Wysyłka z Europy
                </div>
              ) : originBadgeLabel ? (
                <div className="flex items-center space-sm font-semibold text-sm">
                  <Package className="w-4 h-4" />
                  {originBadgeLabel}
                </div>
              ) : null}
            </div>
            
            {/* Main Price - BIG & BOLD */}
            <div className="flex items-baseline space-sm mb-2">
              <span className="text-4xl font-black text-primary">
                {priceData.formattedPrice || 'N/A'}
              </span>
              {priceData.formattedOriginal && (
                <span className="text-base text-secondary line-through">
                  {priceData.formattedOriginal}
                </span>
              )}
              {typeof priceData.discount === 'number' && priceData.discount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  -{priceData.discount}%
                </Badge>
              )}
            </div>

            {/* Price Breakdown (Item + Shipping) */}
            {priceData.formattedShipping && (
              <div className="text-sm text-secondary space-y-1 mt-2">
                <div className="flex justify-between">
                  <span className="font-medium">Dostawa:</span>
                  <span className="font-semibold">{priceData.formattedShipping}</span>
                </div>
              </div>
            )}

            {/* Free Shipping Callout */}
            {priceData.formattedShipping === null && (
              <div className="flex items-center space-sm text-emerald-600 dark:text-emerald-400 text-base font-bold mt-2">
                <Check className="w-4 h-4" />
                <span>Dostawa gratis!</span>
              </div>
            )}

            {/* Price Guarantee Info - disabled for now */}
            {false && typeof product.price === 'object' && product.price.lowestPrice30Days && (
              <div className="flex items-center space-sm text-blue-600 dark:text-blue-400 text-sm mt-2.5 font-medium">
                <Info className="w-4 h-4" />
                <span>
                  Najniższa cena z 30 dni: {CurrencyManager.formatPrice(product.price.lowestPrice30Days, currency)}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className={cn(
            "flex flex-col gap-2",
            viewMode === 'list' ? "mt-auto" : "mt-auto pt-2"
          )}>
            
            {/* PRIMARY: Buy Now Button (Direct Affiliate) */}
            <Button
              asChild
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-sm h-10 shadow-md hover:shadow-lg transition-all"
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

            <div className={cn(
              "flex items-center gap-2",
              viewMode === 'list' ? "" : ""
            )}>
              {/* SECONDARY: Add to Shared Cart Button */}
              <Button
                onClick={handleAddToCart}
                disabled={isAddingToCart || inCart}
                className={cn(
                  "flex-1 font-semibold transition-all h-9 text-xs",
                  inCart 
                    ? "bg-green-500 hover:bg-green-600 text-white" 
                    : "bg-primary hover:bg-primary/90"
                )}
                size="default"
              >
                {isAddingToCart ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-2" />
                    Dodawanie...
                  </>
                ) : inCart ? (
                  <>
                    <Check className="w-3 h-3 mr-2" />
                    W koszyku
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-3 h-3 mr-2" />
                    Do koszyka
                  </>
                )}
              </Button>

              {viewMode !== 'list' && (
                /* Compare Button */
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addToComparison({ ...product, type: 'product' });
                  }}
                  className="px-2 h-9 border-2 border-strong hover:bg-surface-hover bg-surface"
                >
                  <Scale className="w-3 h-3 mr-1" />
                  Porównaj
                </Button>
              )}
            </div>

            {/* Favorite Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleFavorite();
                    }}
                    disabled={isLoading}
                    className={cn(
                      "px-3 btn-icon-hover border-2 border-strong hover:bg-surface-hover bg-surface",
                      isFavorited && "bg-red-50 dark:bg-red-900/50 border-red-300 dark:border-red-500"
                    )}
                  >
                    <Heart 
                      className={cn(
                        "w-4 h-4 btn-favorite",
                        isFavorited && "btn-favorite-active"
                      )} 
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFavorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {viewMode !== 'list' && (
              <ShareButton
                type="product"
                itemId={product.id}
                url={`${typeof window !== 'undefined' ? window.location.origin : ''}${productUrl}`}
                title={displayTitle}
                onShared={handleShare}
              />
            )}
          </div>
          
          </div>
          
          {viewMode !== 'list' && (
            <>
              {/* Comments Count */}
              {commentsCount > 0 && (
                <Link 
                  href={`${productUrl}#comments`}
                  onClick={handleDetailClick}
                  className="flex items-center space-sm text-sm text-secondary hover:text-primary transition-colors-fast"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{commentsCount} {commentsCount === 1 ? 'komentarz' : 'komentarzy'}</span>
                </Link>
              )}

              {/* Merchant Trust Badge (Bottom) */}
              {merchantRating > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-subtle">
                  <div className="flex items-center gap-1">
                    <ShieldCheck className={cn(
                      "w-4 h-4",
                      isVerifiedMerchant ? "text-green-500" : "text-gray-400"
                    )} />
                    <span className="text-xs text-secondary">
                      Sprzedawca: {Number.isFinite(merchantRating) ? merchantRating.toFixed(0) : '—'}%
                    </span>
                  </div>
                  {isBestseller && (
                    <>
                      <span className="text-tertiary">•</span>
                      <Badge variant="secondary" className="text-xs">
                        <TrendingDown className="w-3 h-3 mr-1" />
                        Bestseller
                      </Badge>
                    </>
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* Edit Dialog for Admin */}
      {user?.role === 'admin' && (
        <ProductEditDialog
          product={product}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}
    </>
  );
}
