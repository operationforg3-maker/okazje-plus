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
import { useCurrency } from '@/context/currency-context';
import { 
  getPriceAmount, 
  getTotalPrice, 
  formatPrice, 
  isFreeShipping,
  getDiscountPercent 
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
  const [isMounted, setIsMounted] = useState(false);
  const [locale, setLocale] = useState('pl');
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

  // Hydration safety - sync locale on mount
  useEffect(() => {
    setIsMounted(true);
    setLocale(localeFromParams);
  }, [localeFromParams]);

  const titleText = typeof product.title === 'string' 
    ? product.title 
    : getText(product.title);
  const displayTitle = titleText || product.name || 'Produkt';
  
  // Smart Pricing with total landed cost
  const itemPrice = getPriceAmount(product.price);
  const shippingCost = typeof product.price === 'object' && 'shippingCost' in product.price 
    ? product.price.shippingCost || 0
    : 0;
  const totalPrice = getTotalPrice(product.price);
  const discountPercent = getDiscountPercent(product.price);
  const hasFreeShipping = isFreeShipping(product.price);
  const hasPriceGuarantee = typeof product.price === 'object' && 
    'lowestPrice30Days' in product.price && 
    product.price.lowestPrice30Days !== undefined;
  
  // Currency detection
  const currency = typeof product.price === 'object' && 'currency' in product.price 
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
  
  const isHotDeal = tags.includes('hot_deal');
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

  const { formatPrice } = useCurrency();
  const totalUSD = (product.price?.baseAmount || 0) + (product.price?.shippingCostUSD || 0);

  const originalAmount = typeof product.price === 'object' && 'originalAmount' in product.price
    ? (product.price as any).originalAmount
    : null;
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

  // Product URL
  const productUrl = `${prefix}/products/${(product as any).slug || product.id}`;

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
        "card-interactive group relative overflow-hidden bg-card border border-border hover:border-primary/40 dark:hover:border-primary/60 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300",
        viewMode === 'list' ? "flex flex-row gap-6 p-6" : "flex flex-col"
      )}>
        
        {/* Admin Edit Button (Top-right overlay) */}
        {user?.role === 'admin' && (
          <div className="absolute top-2 right-2 z-20">
            <AdminEditButton
              onClick={() => setEditDialogOpen(true)}
              variant="ghost"
              size="sm"
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800"
            />
          </div>
        )}

        {/* Product Gallery */}
        <Link 
          href={productUrl} 
          onClick={handleDetailClick} 
          className={cn(
            "relative block",
            viewMode === 'list' ? "w-64 flex-shrink-0" : "w-full"
          )}
        >
          <ProductGallery images={galleryImages} />
          
          {/* Trust Badges Overlay (Top-left) */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            {hasFreeShipping && (
              <Badge className="bg-emerald-500 text-white badge-trust">
                <Truck className="w-3 h-3 mr-1" />
                Darmowa dostawa
              </Badge>
            )}
            
            {hasPriceGuarantee && (
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
          "flex flex-col flex-1 space-y-3",
          viewMode === 'list' ? "py-2" : "p-4"
        )}>
          
          {/* Title (AI-Curated Clean Title) */}
          <Link href={productUrl} onClick={handleDetailClick}>
            <h3 className={cn(
              "text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary dark:hover:text-primary transition-colors",
              viewMode === 'list' ? "line-clamp-3" : "line-clamp-2"
            )}>
              {product.title?.pl || product.title?.en || product.title?.de || product.name || 'Produkt'}
            </h3>
          </Link>

          {/* Enhanced Tags Row */}
          {(isHotDeal || isBestsellerTag || isNewArrival || hasVariants || hasRealShipping) && (
            <div className="flex flex-wrap gap-1.5">
              {isHotDeal && (
                <Badge variant="destructive" className="text-xs">
                  <Flame className="w-3 h-3 mr-1" />
                  Hot Deal
                </Badge>
              )}
              {isBestsellerTag && (
                <Badge variant="default" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Bestseller
                </Badge>
              )}
              {isNewArrival && (
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Nowość
                </Badge>
              )}
              {hasVariants && (
                <Badge variant="outline" className="text-xs">
                  {variants.length} wariantów
                </Badge>
              )}
              {hasRealShipping && shippingInfo.cost > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Truck className="w-3 h-3 mr-1" />
                  {shippingInfo.cost} PLN
                </Badge>
              )}
            </div>
          )}

          {/* Rating & Social Proof */}
          {productRating > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {Number.isFinite(productRating) ? productRating.toFixed(1) : '—'}
                </span>
              </div>
              
              {ratingCount > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({ratingCount.toLocaleString()} ocen)
                </span>
              )}

              {ordersCount > 0 && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {ordersCount.toLocaleString()} zamówień
                  </span>
                </>
              )}

              {commentsCount >= 0 && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {commentsCount} opinii
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

          {/* Feature badges to highlight available actions */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Badge variant="outline" className="gap-1 border-gray-200 dark:border-gray-700">
              <Scale className="w-3 h-3" />
              Porównaj
            </Badge>
            <Badge variant="outline" className="gap-1 border-gray-200 dark:border-gray-700">
              <ShoppingCart className="w-3 h-3" />
              Wspólny koszyk
            </Badge>
            <Badge variant="outline" className="gap-1 border-gray-200 dark:border-gray-700">
              <Heart className="w-3 h-3" />
              Ulubione
            </Badge>
            <Badge variant="outline" className="gap-1 border-gray-200 dark:border-gray-700">
              <MessageSquare className="w-3 h-3" />
              Opinie
            </Badge>
          </div>

          {/* ========================================
              💎 TOTAL LANDED COST (Trust-First Hero)
              ======================================== */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/20 dark:to-primary/30 rounded-lg p-5 border border-primary/20 dark:border-primary/30">

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground dark:text-gray-300 mb-3">
              <div className="flex items-center gap-2">
                {hasDiscount && (
                  <Badge className="badge-hot badge-trust px-2 py-1">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    -{discountPercent}%
                  </Badge>
                )}
                {originalAmount && (
                  <span className="line-through">
                    {formatPrice(originalAmount, currency)}
                  </span>
                )}
              </div>

              {shipsFromEU ? (
                <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <Truck className="w-3 h-3" />
                  Wysyłka z Europy
                </div>
              ) : originBadgeLabel ? (
                <div className="flex items-center gap-1 font-medium text-xs">
                  <Package className="w-3 h-3" />
                  {originBadgeLabel}
                </div>
              ) : null}
            </div>
            
            {/* Main Price - BIG & BOLD */}
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {formatPrice(totalPrice, currency)}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                z dostawą
              </span>
            </div>

            {/* Price Breakdown (Item + Shipping) */}
            {!hasFreeShipping && shippingCost > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>Produkt:</span>
                  <span className="font-medium">{formatPrice(itemPrice, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dostawa:</span>
                  <span className="font-medium">{formatPrice(shippingCost, currency)}</span>
                </div>
              </div>
            )}

            {/* Free Shipping Callout */}
            {hasFreeShipping && (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-medium mt-1">
                <Check className="w-4 h-4" />
                <span>Dostawa gratis!</span>
              </div>
            )}

            {/* Price Guarantee Info */}
            {hasPriceGuarantee && typeof product.price === 'object' && product.price.lowestPrice30Days && (
              <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs mt-2">
                <Info className="w-3 h-3" />
                <span>
                  Najniższa cena z 30 dni: {formatPrice(product.price.lowestPrice30Days, currency)}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className={cn(
            "flex items-center gap-2 mt-auto",
            viewMode === 'list' ? "pt-4" : "pt-2"
          )}>
            
            {/* Add to Cart Button (Primary CTA) */}
            <Button
              onClick={handleAddToCart}
              disabled={isAddingToCart || inCart}
              className={cn(
                "flex-1 font-medium transition-all",
                inCart 
                  ? "bg-green-500 hover:bg-green-600 text-white" 
                  : "bg-primary hover:bg-primary/90"
              )}
              size="sm"
            >
              {isAddingToCart ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Dodawanie...
                </>
              ) : inCart ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  W koszyku
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Do wspólnego koszyka
                </>
              )}
            </Button>

            {/* Compare Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addToComparison({ ...product, type: 'product' });
              }}
              className="px-3 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Scale className="w-4 h-4 mr-2" />
              Porównaj
            </Button>

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
                      "px-3 btn-icon-hover border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800",
                      isFavorited && "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
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

            {/* Share Button */}
            <ShareButton
              type="product"
              itemId={product.id}
              url={`${typeof window !== 'undefined' ? window.location.origin : ''}${productUrl}`}
              title={displayTitle}
              onShared={handleShare}
            />
          </div>

          {/* Comments Count */}
          {commentsCount > 0 && (
            <Link 
              href={`${productUrl}#comments`}
              onClick={handleDetailClick}
              className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{commentsCount} {commentsCount === 1 ? 'komentarz' : 'komentarzy'}</span>
            </Link>
          )}

          {/* Merchant Trust Badge (Bottom) */}
          {merchantRating > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-1">
                <ShieldCheck className={cn(
                  "w-4 h-4",
                  isVerifiedMerchant ? "text-green-500" : "text-gray-400"
                )} />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Sprzedawca: {Number.isFinite(merchantRating) ? merchantRating.toFixed(0) : '—'}%
                </span>
              </div>
              {isBestseller && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <Badge variant="secondary" className="text-xs">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    Bestseller
                  </Badge>
                </>
              )}
            </div>
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
