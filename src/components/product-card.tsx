"use client";

/**
 * ========================================
 * TRUST-FIRST PRODUCT CARD (M4 Redesign)
 * ========================================
 * 
 * Key Features:
 * ✅ Total Landed Cost Display (item + shipping) — biggest trust signal
 * ✅ AI-Generated Clean Titles (no AliExpress spam keywords)
 * ✅ Dynamic Trust Badges (Free Shipping, Price Guarantee, Fast Delivery, Verified Merchant)
 * ✅ Smart Cart Integration (Add to Bundle button)
 * ✅ Multi-Language Support (getText with auto-fallback pl→en→de)
 * ✅ Enhanced Trust Signals (ratings, merchant score, order count)
 * ✅ Optimized for Conversion (CTA hierarchy, visual trust indicators)
 */

import { ProductGallery } from './product-gallery';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  Star, Tag, ExternalLink, Heart, MessageSquare, Truck, Package, 
  Zap, AlertTriangle, ShieldCheck, Info, Share2, ShoppingCart, 
  TrendingDown, Award, Clock, Check, Plus, Eye
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
import { 
  getPriceAmount, 
  getTotalPrice, 
  formatPrice, 
  isFreeShipping,
  getDiscountPercent 
} from '@/lib/i18n-utils';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  showFullDetails?: boolean;
}

export default function ProductCard({ product, showFullDetails = false }: ProductCardProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  const { getText } = useContentLanguage();
  const { addItem, isInCart } = useSmartCart();
  const { isFavorited, isLoading, toggleFavorite } = useFavorites(product.id, 'product');
  const { user } = useAuth();
  const { count: commentsCount } = useCommentsCount('products', product.id);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // ========================================
  // 💡 M4 SMART DATA EXTRACTION
  // ========================================
  
  // AI-curated clean title (no spam keywords like "HOT SALE 2025!!!")
  const displayTitle = getText(product.title) || product.name || 'Produkt';
  
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

  // ========================================
  // 💡 ANALYTICS & LIFECYCLE
  // ========================================
  
  useEffect(() => {
    if (!hasTrackedView) {
      void trackFirestoreView('product', product.id, user?.uid);
      setHasTrackedView(true);
    }
  const { formatPrice } = useCurrency();
  const totalUSD = (product.price?.baseAmount || 0) + (product.price?.shippingCostUSD || 0);

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
          <h3 className="line-clamp-2 text-sm font-medium">{product.title.pl || product.title.en || product.title.de}</h3>
      }))
            <span className="text-lg font-bold">{formatPrice(totalUSD)}</span>
            {product.price.shippingCostUSD === 0 && (
              <span className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Darmowa dostawa</span>
            )}
  // ========================================
  
  return (
    <>
      <div className="group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden">
        
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
        <Link href={productUrl} onClick={handleDetailClick} className="relative block">
          <ProductGallery images={galleryImages} />
          
          {/* Trust Badges Overlay (Top-left) */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            {hasFreeShipping && (
              <Badge className="bg-emerald-500 text-white border-0 shadow-lg backdrop-blur-sm font-medium">
                <Truck className="w-3 h-3 mr-1" />
                Darmowa dostawa
              </Badge>
            )}
            
            {hasPriceGuarantee && (
              <Badge className="bg-blue-500 text-white border-0 shadow-lg backdrop-blur-sm font-medium">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Gwarancja ceny
              </Badge>
            )}
            
            {hasFastShipping && (
              <Badge className="bg-amber-500 text-white border-0 shadow-lg backdrop-blur-sm font-medium">
                <Zap className="w-3 h-3 mr-1" />
                Szybka dostawa
              </Badge>
            )}
            
            {isVerifiedMerchant && (
              <Badge className="bg-indigo-500 text-white border-0 shadow-lg backdrop-blur-sm font-medium">
                <Award className="w-3 h-3 mr-1" />
                Zweryfikowany
              </Badge>
            )}
          </div>

          {/* Discount Badge (Top-right corner) */}
          {discountPercent && discountPercent > 0 && (
            <div className="absolute top-3 right-3 z-10">
              <Badge className="bg-red-500 text-white border-0 shadow-lg text-base font-bold px-3 py-1.5">
                <TrendingDown className="w-4 h-4 mr-1" />
                -{discountPercent}%
              </Badge>
            </div>
          )}
        </Link>

        {/* Content Area */}
        <div className="flex flex-col flex-1 p-4 space-y-3">
          
          {/* Title (AI-Curated Clean Title) */}
          <Link href={productUrl} onClick={handleDetailClick}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 hover:text-primary transition-colors leading-snug">
              {displayTitle}
            </h3>
          </Link>

          {/* Rating & Social Proof */}
          {productRating > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {productRating.toFixed(1)}
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
            </div>
          )}

          {/* ========================================
              💎 TOTAL LANDED COST (Trust-First Hero)
              ======================================== */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 rounded-lg p-4 border border-primary/20">
            
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
          <div className="flex items-center gap-2 mt-auto pt-2">
            
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
                  Dodaj do listy
                </>
              )}
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
                      "px-3",
                      isFavorited && "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                    )}
                  >
                    <Heart 
                      className={cn(
                        "w-4 h-4",
                        isFavorited && "fill-red-500 text-red-500"
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
                  Sprzedawca: {merchantRating.toFixed(0)}%
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
