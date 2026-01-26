// @ts-nocheck
'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import type { Deal, Product } from '@/lib/types';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { useCategoryName } from '@/hooks/use-category-name';
import { useComparison } from '@/components/deal-comparison-tool';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Flame, MessageSquare, Tag, TrendingUp, Sparkles, Clock, Heart, Truck, Package, Zap, AlertTriangle, ShieldCheck, Star, Info, Scale, Share2, DollarSign, Video } from "lucide-react";
import { useState } from 'react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useFavorites } from '@/hooks/use-favorites';
import { useSmartCart } from '@/lib/cart-context';
import { trackVote, trackFirestoreView, trackFirestoreClick, trackFirestoreShare, trackFirestoreVote } from '@/lib/analytics';
import ShareButton from '@/components/share-button';
import { RatingBar } from './rating-bar';
import { AdminQuickActions } from '@/components/admin/admin-quick-actions';
// import DealEditDialog from '@/components/admin/deal-edit-dialog';
import { ExpiredDealBadge } from '@/components/expired-deal-badge';
import { useContentLanguage } from '@/hooks/use-content-language';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCurrency, CurrencyManager } from '@/lib/unified-currency';
import { extractPriceInfo, getDiscountPercent } from '@/lib/i18n-utils';
import { CategoryBreadcrumb } from '@/components/category-breadcrumb';
// TEMPORARILY REMOVED FOR DEBUGGING React #418:
// import { Sparkline, generateSmartBadges } from '@/components/product/Sparkline';
// import { SpecsTeaserInline } from '@/components/product/SpecificationsTable';

interface DealCardProps {
  deal: Deal | any;  // M6: Accept both DealLegacy and M6 Deal formats
  product?: Product | null;
}

const safeText = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

function toTimestampSafe(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const n = Date.parse(value);
    return Number.isNaN(n) ? 0 : n;
  }
  if (typeof value === 'object') {
    try {
      if (typeof (value as any).toDate === 'function') {
        return (value as any).toDate().getTime();
      }
      if (typeof (value as any).seconds === 'number') {
        return ((value as any).seconds * 1000) + Math.floor(((value as any).nanoseconds || 0) / 1e6);
      }
    } catch {}
  }
  return 0;
}

function getRelativeTime(when: any): string {
  const now = new Date();
  const ts = toTimestampSafe(when);
  const posted = ts ? new Date(ts) : new Date(0);
  const diffMs = now.getTime() - posted.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 60) return `${diffMinutes} min temu`;
  if (diffHours < 24) return `${diffHours} godz. temu`;
  if (diffDays === 1) return 'wczoraj';
  if (diffDays < 7) return `${diffDays} dni temu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tyg. temu`;
  return `${Math.floor(diffDays / 30)} mies. temu`;
}

export default function DealCard({ deal, product }: DealCardProps) {
  // Używaj przekazanego ProductCore jeśli dostępny (spójność z ProductCard)
  const resolvedProduct = product || null;
  const params = useParams();
  const [isMounted, setIsMounted] = useState(false);
  const localeFromParams = (params?.locale as string) || 'pl';
  const [locale, setLocale] = useState('pl');
  const prefix = `/${locale}`;
  const { getText } = useContentLanguage();
  const liveComments = useCommentsCount('deals', deal.id, deal.commentsCount);
  const { mainName: categoryLabel } = useCategoryName(
    deal.mainCategorySlug || resolvedProduct?.mainCategorySlug,
    deal.subCategorySlug || resolvedProduct?.subCategorySlug,
    deal.subSubCategorySlug || resolvedProduct?.subSubCategorySlug
  );
  const { addToComparison } = useComparison();
  const { user } = useAuth();
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(deal.id, 'deal');
  // Usunięto wywołanie useCoupons - dane kuponów powinny być już w Firestore
  const [temperature, setTemperature] = useState(deal.temperature);
  const [voteCount, setVoteCount] = useState(deal.voteCount);
  const [isVoting, setIsVoting] = useState(false);
  const [userVote, setUserVote] = useState<1 | -1 | null>(null); // Śledzimy głos użytkownika
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isNew, setIsNew] = useState(false); // Will be calculated in useEffect
  const [relativeTime, setRelativeTime] = useState(''); // Will be calculated in useEffect
  const { currency } = useCurrency();
  const { addDeal } = useSmartCart();
  
  // Format prices using state to fix Intl.NumberFormat hydration mismatch
  const [priceData, setPriceData] = useState<{
    formattedPrice: string | null;
    formattedOriginal: string | null;
    formattedSavings: string | null;
    formattedShippingCost: string | null;
    discount: number | null;
  }>({
    formattedPrice: null,
    formattedOriginal: null,
    formattedSavings: null,
    formattedShippingCost: null,
    discount: null,
  });

  // Hydration safety - sync locale on mount
  useEffect(() => {
    setIsMounted(true);
    setLocale(localeFromParams);
  }, [localeFromParams]);

  // Format prices on client only (using unified currency system)
  // M6: Support both legacy (deal.price = number) and new (deal.price = {amount, currency}) formats
  useEffect(() => {
    if (!isMounted) return;
    const userCurrency = currency || 'PLN';
    
    // M6 compatibility: Robust extraction using shared utility
    // Price logic: (deal.price {amount, currency}) -> (legacy deal.price number) -> (deal.legacyPrice)
    const { amount: priceAmount, currency: extractedCurrency } = extractPriceInfo(deal.price, deal.legacyPrice);
    
    // Normalize source currency
    let sourceCurrency: any = (extractedCurrency || 'PLN').toUpperCase();
    
    // Safety check for supported currencies (redundant if using CurrencyManager.convertToPLN which does this check, but good for explicit typing)
    if (!['PLN', 'USD', 'EUR', 'GBP'].includes(sourceCurrency)) {
      // If unknown currency, try to keep it for logging, but convertToPLN handles it gracefully
      // For now, let's keep it as is to allow CurrencyManager to warn
    }
    
    const safePrice = Number(priceAmount) || 0;
    
    // Ensure we work with PLN for CurrencyManager
    // If source is not PLN, we must convert TO PLN first
    const priceInPLN = CurrencyManager.convertToPLN(safePrice, sourceCurrency);
    const formatted = CurrencyManager.formatPrice(priceInPLN, userCurrency);

    let formattedOrig: string | null = null;
    let calculatedDiscount: number | null = null;
    let savings: string | null = null;
    let shipping: string | null = null;

    if (typeof deal.originalPrice === 'number') {
      const origInPLN = CurrencyManager.convertToPLN(deal.originalPrice, sourceCurrency);
      formattedOrig = CurrencyManager.formatPrice(origInPLN, userCurrency);

      if (deal.originalPrice > 0) {
        calculatedDiscount = Math.round(100 - (safePrice / deal.originalPrice) * 100);
      }

      if (deal.originalPrice > safePrice) {
        const savingsInPLN = origInPLN - priceInPLN;
        savings = CurrencyManager.formatPrice(savingsInPLN, userCurrency);
      }
    }

    if (typeof deal.shippingCost === 'number' && deal.shippingCost > 0) {
      const shippingInPLN = CurrencyManager.convertToPLN(deal.shippingCost, sourceCurrency);
      shipping = CurrencyManager.formatPrice(shippingInPLN, userCurrency);
    }

    setPriceData({
      formattedPrice: formatted,
      formattedOriginal: formattedOrig,
      formattedSavings: savings,
      formattedShippingCost: shipping,
      discount: calculatedDiscount,
    });
  }, [isMounted, currency, deal.price, deal.originalPrice, deal.shippingCost]);
  const postedBy = safeText(deal.postedBy, 'Użytkownik');

  const coverImage = typeof deal.image === 'string' && deal.image ? deal.image : resolvedProduct?.images?.[0];
  const gallery = Array.isArray(deal.gallery) && deal.gallery.length > 0
    ? deal.gallery
    : (resolvedProduct?.images || (coverImage ? [coverImage] : []));
  
  // Get localized deal title and description - use safe defaults to prevent hydration mismatch
  // Handle both LocalizedText and legacy string formats
  // NOTE: Empty string fallback is intentional - if deal title is missing, it should come from ProductCore
  const titleObj = typeof deal.title === 'object' ? deal.title : { pl: deal.title || '', en: deal.title || '' };
  const descObj = typeof deal.description === 'object' ? deal.description : { pl: deal.description || '', en: deal.description || '' };
  
  const dealTitle = isMounted ? getText(titleObj) : (titleObj.pl || '');
  const dealDescription = isMounted ? getText(descObj) : (descObj.pl || '');
  
  const couponCode = safeText(deal.couponCode);
  const deliveryTime = safeText(deal.importMetadata?.deliveryTime);
  const warehouseInfo = safeText(deal.importMetadata?.warehouse);
  const returnPolicy = safeText(deal.importMetadata?.returnPolicy);

  // ========================================
  // 🚀 ENHANCED METADATA FROM AUTO-IMPORT
  // ========================================
  
  const metadata = {
    ...(resolvedProduct?.metadata || {}),
    ...(deal.metadata || {}),
  };

  const specsFromObject = (resolvedProduct as any)?.specs
    ? Object.entries((resolvedProduct as any).specs).map(([label, value]) => ({ label, value }))
    : [];

  const variants = (metadata as any).variants || [];
  const specifications = (metadata as any).specifications || specsFromObject;
  const shippingInfo = (metadata as any).shipping || (resolvedProduct as any)?.shipping || {};
  const warrantyInfo = (metadata as any).warranty || {};
  const tags = (metadata as any).tags || [];
  const commission = (metadata as any).commission;
  const stats = (metadata as any).stats || {};
  const source = (metadata as any).source || 'manual';
  
  // Smart badges from tags
  const isHotDealTag = tags.includes('hot_deal');
  const isBestsellerTag = tags.includes('bestseller');
  const isNewArrival = tags.includes('new_arrival');
  const isPolishMarket = tags.includes('polish_market');
  const hasVariants = variants.length > 0;
  const hasRealShipping = shippingInfo.cost !== undefined;

  const isHot = temperature >= 300;

  const temperatureColor = temperature >= 500 ? 'from-red-500 to-orange-500' 
    : temperature >= 300 ? 'from-orange-500 to-amber-500'
    : temperature >= 100 ? 'from-amber-500 to-yellow-500'
    : 'from-yellow-500 to-green-500';

  const temperaturePercent = Math.min((temperature / 500) * 100, 100);
  
  // ========================================================================
  // DEEP DATA SMART BADGES - TEMPORARILY DISABLED FOR DEBUGGING
  // ========================================================================
  // const deepDataBadges = generateSmartBadges({
  //   price: {
  //     current: deal.price,
  //     lowest30d: deal.lowestPriceIn30Days,
  //   },
  //   logistics: product?.logistics,
  //   priceHistory: deal.priceHistory,
  // });
  const deepDataBadges = []; // Empty array to prevent errors

  const handleVote = async (action: 'up' | 'down') => {
    if (!user) {
      toast.error("Musisz być zalogowany, aby zagłosować.");
      return;
    }

    // Optimistic update
    const oldTemperature = temperature;
    const oldVoteCount = voteCount;
    const oldUserVote = userVote;
    
    // Oblicz przewidywane zmiany
    let tempDelta = 0;
    let voteDelta = 0;
    const newVoteValue = action === 'up' ? 1 : -1;
    
    if (userVote === null) {
      // Nowy głos
      tempDelta = newVoteValue;
      voteDelta = newVoteValue;
    } else if (userVote === newVoteValue) {
      // Ten sam głos - brak zmian (idempotencja)
      return;
    } else {
      // Zmiana głosu
      tempDelta = newVoteValue - userVote;
      voteDelta = newVoteValue - userVote;
    }

    // Optimistic update UI
    setTemperature(prev => prev + tempDelta);
    setVoteCount(prev => prev + voteDelta);
    setUserVote(newVoteValue);
    setIsVoting(true);

    try {
      // Pobierz token Firebase Auth
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error('Sesja wygasła - zaloguj się ponownie');
      }
      const token = await firebaseUser.getIdToken();

      const response = await fetch(`/api/deals/${deal.id}/vote`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action }),
      });

      // Debug: sprawdź czy response jest OK
      if (!response.ok) {
        const responseText = await response.text();
        console.error('Vote response error:', {
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          contentType: response.headers.get('content-type'),
        });
        throw new Error(`Serwer zwrócił błąd ${response.status}: ${responseText || response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Błąd podczas głosowania');
      }

      setTemperature(data.temperature);
      setVoteCount(data.voteCount);
      setUserVote(data.userVote);
      
      trackVote('deal', deal.id, action);
      void trackFirestoreVote('deal', deal.id, user.uid, action);
      
      toast.success("Dziękujemy za oddanie głosu!");
    } catch (error: any) {
      setTemperature(oldTemperature);
      setVoteCount(oldVoteCount);
      setUserVote(oldUserVote);
      
      toast.error(error.message || "Wystąpił błąd podczas głosowania.");
      console.error('Vote error:', error);
    } finally {
      setIsVoting(false);
    }
  };

  // Track wyświetlenie karty (raz na sesję)
  // Używamy useEffect aby nie wykonywać na serwerze
  // i aby nie trackować podczas prerenderowania
  require('react'); // dummy to ensure React import side-effects
  if (typeof window !== 'undefined') {
    // Lazy trigger view tracking (minimal debounce via sessionStorage w helperze)
    void trackFirestoreView('deal', deal.id, user?.uid);
  }

  const handleDetailClick = () => {
    void trackFirestoreClick('deal', deal.id, user?.uid);
  };

  const handleShareTrack = (platform?: string) => {
    void trackFirestoreShare('deal', deal.id, user?.uid, platform);
  };

  // Listen for global vote events to refresh this card's data
  useEffect(() => {
    const handler = async (e: Event) => {
      try {
        const detail = (e as CustomEvent)?.detail;
        if (!detail || detail.dealId !== deal.id) return;
        // Fetch latest deal document from Firestore
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const docRef = doc(db, 'deals', deal.id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as any;
          if (typeof data.temperature === 'number') setTemperature(data.temperature);
          if (typeof data.voteCount === 'number') setVoteCount(data.voteCount);
        }
      } catch (err) {
        // ignore
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('deal-voted', handler as EventListener);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('deal-voted', handler as EventListener);
      }
    };
  }, [deal.id]);

  // Initialize time-dependent values on client to fix hydration mismatch
  useEffect(() => {
    // Calculate isNew
    const posted = new Date(deal.postedAt);
    const now = new Date();
    const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
    setIsNew(diffDays <= 7);

    // Calculate relative time
    const relTime = getRelativeTime(deal.postedAt);
    setRelativeTime(relTime);
  }, [deal.postedAt]);


  return (
    <div 
      className="card-interactive group flex h-full flex-col overflow-hidden cursor-pointer"
      onClick={() => {
        window.location.href = `${prefix}/deals/${deal.id}`;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          window.location.href = `${prefix}/deals/${deal.id}`;
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div className="relative overflow-hidden aspect-square bg-muted">
        {/* Pasek ocen produktu jeśli powiązany */}
        {resolvedProduct && resolvedProduct.ratingSources && (
          <div className="absolute left-1.5 top-1.5 z-10">
            <RatingBar users={resolvedProduct.ratingSources.users} editorial={resolvedProduct.ratingSources.editorial} external={resolvedProduct.ratingSources.external} />
          </div>
        )}
        <Image
          src={coverImage || '/placeholder.png'}
          alt={dealTitle || 'Okazja'}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-contain transition-transform-base group-hover:scale-105"
        />
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
        <div className="absolute right-2 top-2 flex flex-col space-sm z-10 gap-1">
          {/* Social Proof Badge */}
          {((resolvedProduct as any)?.marketing?.ordersCount || (deal as any)?.marketing?.ordersCount || 0) > 10 && (
            <div className="bg-red-600/90 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm flex items-center gap-1 shadow-sm">
               <Flame className="w-3 h-3" />
               <span className="font-medium">
                 {((resolvedProduct as any)?.marketing?.ordersCount || (deal as any)?.marketing?.ordersCount)} kupiło
               </span>
            </div>
          )}
          {isHot && (
            <Badge className="badge-hot badge-trust">
              <Flame className="mr-1 h-3 w-3 md:h-4 md:w-4" />
              Hot {temperature}°
            </Badge>
          )}
          {isHotDealTag && (
            <Badge variant="destructive" className="shadow-md">
              <Zap className="mr-1 h-3 w-3" />
              Hot Deal
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
          {isNew && (
            <Badge className="badge-cool badge-trust">
              <Sparkles className="mr-1 h-3 w-3 md:h-4 md:w-4" />
              Nowa oferta
            </Badge>
          )}
          {isPolishMarket && (
            <Badge className="bg-green-500 text-white shadow-md">
              PL Market
            </Badge>
          )}
          {hasVariants && (
            <Badge variant="secondary" className="shadow-md">
              {variants.length} wariantów
            </Badge>
          )}
          {deal.freeShipping && (
            <Badge className="bg-emerald-500 text-white badge-trust">
              <Truck className="mr-1 h-3 w-3 md:h-4 md:w-4" />
              Darmowa dostawa
            </Badge>
          )}
          {deal.importMetadata?.hotProduct && (
            <Badge className="badge-hot badge-trust animate-pulse">
              <Zap className="mr-1 h-3 w-3" />
              HOT
            </Badge>
          )}
          {deal.importMetadata?.flashDeal && (
            <Badge className="bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md">
              <Zap className="mr-1 h-3 w-3" />
              Flash
            </Badge>
          )}
          {deal.importMetadata?.stockStatus === 'low_stock' && (
            <Badge variant="outline" className="border-yellow-600 text-yellow-600 bg-white/90 shadow-md">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Niski stan
            </Badge>
          )}
          {deal.importMetadata?.stockStatus === 'out_of_stock' && (
            <Badge variant="outline" className="border-red-600 text-red-600 bg-white/90 shadow-md">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Wyprzedane
            </Badge>
          )}
          {deal.importMetadata?.promotionId && (
            <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md">
              <Tag className="mr-1 h-3 w-3" />
              Promocja
            </Badge>
          )}
        </div>
        
        {/* Admin Quick Actions (Bottom-right overlay) */}
        <div className="absolute right-2 bottom-2">
          <AdminQuickActions
            productId={deal.product?.id || deal.id} // Deal might link to product, or assume deal ID if product missing
            itemType="deal"
            onEdit={() => setEditDialogOpen(true)}
          />
        </div>
      </div>
      
      {/* Edit Dialog (Admin only) */}
      {/* {user?.role === 'admin' && (
        <DealEditDialog
          deal={deal}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )} */}
      
      <div className="flex-grow space-y-2 sm:space-y-3 p-3 sm:p-4 md:p-5">
        {/* Category Breadcrumb - 3 levels with translations */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <CategoryBreadcrumb
            mainCategorySlug={deal.mainCategorySlug}
            subCategorySlug={deal.subCategorySlug}
            subSubCategorySlug={deal.subSubCategorySlug}
            className="flex-grow"
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <Clock className="h-3 w-3 md:h-4 md:w-4" />
            <span className="text-[10px] sm:text-xs">{relativeTime}</span>
          </div>
        </div>

        <h3 className="font-headline text-sm sm:text-base md:text-lg font-semibold leading-tight transition-colors group-hover:text-primary">
          {dealTitle}
        </h3>
        
        {/* Deep Data: Specs Teaser (Product.specificationsStructured) */}
        {/* TEMPORARILY DISABLED FOR DEBUGGING
        {resolvedProduct?.specificationsStructured && resolvedProduct.specificationsStructured.length > 0 && (
          <SpecsTeaserInline specifications={resolvedProduct.specificationsStructured} maxSpecs={2} />
        )}
        */}
        
        {/* Deep Data: Smart Badges (Auto-generated) */}
        {/* TEMPORARILY DISABLED FOR DEBUGGING
        {deepDataBadges && deepDataBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {deepDataBadges.filter(badge => badge && badge.text).map((badge, idx) => {
              // Map badge color to inline style
              const getBadgeColor = (colorClass: string) => {
                if (colorClass.includes('red')) return '#ef4444';
                if (colorClass.includes('green')) return '#10b981';
                if (colorClass.includes('blue')) return '#3b82f6';
                if (colorClass.includes('purple')) return '#a855f7';
                return '#6b7280';
              };
              
              return (
                <Badge 
                  key={idx} 
                  className="text-white text-xs"
                  style={{ backgroundColor: getBadgeColor(badge.color) }}
                >
                  {String(badge.text)}
                </Badge>
              );
            })}
          </div>
        )}
        */}
        
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground line-clamp-2">
          {dealDescription}
        </p>
        
        {/* Deep Data: Sparkline Price Trend */}
        {/* TEMPORARILY DISABLED FOR DEBUGGING
        {deal.priceHistory && Array.isArray(deal.priceHistory) && deal.priceHistory.length > 1 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Trend ceny:</span>
            <Sparkline data={deal.priceHistory} width={80} height={16} />
          </div>
        )}
        */}

        {/* Enhanced Metadata Row */}
        {(hasRealShipping || warrantyInfo.available || specifications.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {hasRealShipping && shippingInfo.cost > 0 && (
              <Badge variant="outline" className="text-xs">
                <Truck className="w-3 h-3 mr-1" />
                Dostawa: {CurrencyManager.formatPrice(shippingInfo.cost, currency || 'PLN')}
              </Badge>
            )}
            {hasRealShipping && shippingInfo.estimatedDays && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                ~{shippingInfo.estimatedDays} dni
              </Badge>
            )}
            {warrantyInfo.available && (
              <Badge variant="outline" className="text-xs">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Gwarancja
              </Badge>
            )}
            {specifications.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs cursor-help">
                      <Info className="w-3 h-3 mr-1" />
                      {specifications.length} spec.
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
          </div>
        )}

        {/* Commission Info (for admins) */}
        {commission && user?.role === 'admin' && (
          <Badge variant="secondary" className="text-xs w-fit gap-1">
            <DollarSign className="h-3 w-3" />
            Prowizja: {commission}%
          </Badge>
        )}

        {/* Szczegóły dostawy i dodatkowe info */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-muted-foreground">
          {/* Enhanced deal tags */}
          {deal.metadata?.dealTags && deal.metadata.dealTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {deal.metadata.dealTags.slice(0, 3).map((tag: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Flash sale indicator */}
          {deal.metadata?.flashSale?.active && (
            <Badge variant="destructive" className="bg-orange-600 animate-pulse">
              <Zap className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              Flash Sale
            </Badge>
          )}
          
          {/* Stock alert */}
          {deal.metadata?.stockAlert?.lowStock && (
            <Badge variant="outline" className="border-yellow-600 text-yellow-600">
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              Tylko {deal.metadata.stockAlert.available} szt.
            </Badge>
          )}
          
          {/* Shipping details */}
          {deal.metadata?.shippingDetails?.free && (
            <Badge variant="default" className="bg-green-600 text-white">
              <Truck className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              Darmowa wysyłka
            </Badge>
          )}
          {deal.metadata?.shippingDetails?.deliveryTime && (
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Dostawa: {deal.metadata.shippingDetails.deliveryTime}
            </span>
          )}
          {deal.metadata?.shippingDetails?.fromCountry && (
            <span>Z: {deal.metadata.shippingDetails.fromCountry}</span>
          )}
          
          {/* Merchant rating */}
          {deal.metadata?.merchantRating && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help">
                    <Star className="h-3 w-3 md:h-4 md:w-4 fill-yellow-400 text-yellow-400" />
                    Sprzedawca: {Number.isFinite(deal.metadata.merchantRating) ? deal.metadata.merchantRating.toFixed(1) : '—'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Ocena sprzedawcy na platformie
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* Certifications */}
          {deal.metadata?.certifications && deal.metadata.certifications.length > 0 && (
            <Badge variant="outline" className="text-xs">
              <ShieldCheck className="h-3 w-3 md:h-4 md:w-4 mr-1" />
              {deal.metadata.certifications.join(', ')}
            </Badge>
          )}
          
          {/* Video indicator */}
          {deal.metadata?.videoUrl && (
            <Badge variant="outline" className="text-xs gap-1">
              <Video className="h-3 w-3" />
              Wideo
            </Badge>
          )}
          
          {/* Legacy fields for backward compatibility */}
          {deliveryTime && !deal.metadata?.shippingDetails && (
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {deliveryTime}
            </span>
          )}
          {warehouseInfo && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              Magazyn: {warehouseInfo}
            </span>
          )}
          {priceData.formattedShippingCost && (
            <span>Koszt wysyłki: {priceData.formattedShippingCost}</span>
          )}
          {deal.cashback && (
            <span className="font-semibold text-green-600">
              Cashback: {typeof deal.cashback.amount === 'number' && deal.cashback.amount > 0 ? CurrencyManager.formatPrice(deal.cashback.amount, currency || 'PLN') : `${deal.cashback.percentage}%`}
              {deal.cashback.provider && ` (${safeText(deal.cashback.provider)})`}
            </span>
          )}
          {couponCode && (
            <span className="font-mono text-primary">Kod: {couponCode}</span>
          )}
          {typeof deal.importMetadata?.sellerRating === 'number' && !deal.metadata?.merchantRating && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    Sprzedawca: {Number.isFinite(deal.importMetadata.sellerRating) ? deal.importMetadata.sellerRating.toFixed(1) : '—'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Ocena sprzedawcy na platformie
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {returnPolicy && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help text-green-600">
                    <ShieldCheck className="h-3 w-3" />
                    Zwroty
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {returnPolicy}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {typeof deal.importMetadata?.evaluateCount === 'number' && deal.importMetadata.evaluateCount > 0 && (
            <span>Oceny: {deal.importMetadata.evaluateCount}</span>
          )}
          {deal.importMetadata?.specifications && Array.isArray(deal.importMetadata.specifications) && deal.importMetadata.specifications.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help">
                    <Info className="h-3 w-3" />
                    Specyfikacja
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1">
                    {deal.importMetadata.specifications.slice(0, 5).map((spec, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-semibold">{safeText(spec?.key)}:</span> {safeText(spec?.value)}
                      </div>
                    ))}
                    {deal.importMetadata.specifications.length > 5 && (
                      <div className="text-[11px] opacity-70">+{deal.importMetadata.specifications.length - 5} więcej</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-lg sm:text-xl md:text-2xl font-bold text-primary">{priceData.formattedPrice || 'N/A'}</span>
          {priceData.formattedOriginal && <span className="text-xs sm:text-sm text-muted-foreground line-through">{priceData.formattedOriginal}</span>}
          {typeof priceData.discount === 'number' && priceData.discount > 0 && (
            <Badge variant="destructive">-{priceData.discount}%</Badge>
          )}
          {priceData.formattedSavings && (
            <span className="ml-auto text-xs font-semibold text-green-600">Oszczędzasz {priceData.formattedSavings}</span>
          )}
        </div>

        {/* Temperature bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Flame className="h-3 w-3" />
              Temperatura
            </span>
            <span className="font-semibold">{temperature} pkt</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className={`h-full bg-gradient-to-r ${temperatureColor} transition-all duration-500`}
              style={{ width: `${temperaturePercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Dodane przez <span className="font-medium text-foreground">{postedBy}</span></span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1" title="Głosy">
              <ArrowUp className="h-3 w-3" />
              {voteCount}
            </span>
            <span className="flex items-center gap-1" title="Komentarze">
              <MessageSquare className="h-3 w-3" />
              {liveComments.count}
            </span>
            {typeof deal.shareCount === 'number' && deal.shareCount > 0 && (
              <span className="flex items-center gap-1" title="Udostępnienia">
                <Share2 className="h-3 w-3" />
                {deal.shareCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <Scale className="h-3 w-3" />
            Porównaj
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Heart className="h-3 w-3" />
            Ulubione
          </Badge>
          <Badge variant="outline" className="gap-1">
            <MessageSquare className="h-3 w-3" />
            Komentarze
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ArrowUp className="h-3 w-3" />
            Głosowanie
          </Badge>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t bg-muted/30 p-2 sm:p-3">
        <div className="flex items-center gap-1 justify-center sm:justify-start">
          <Button 
            variant={userVote === 1 ? "default" : "outline"} 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleVote('up');
            }} 
            aria-label="Głos w górę"
            disabled={isVoting}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button 
            variant={userVote === -1 ? "default" : "outline"} 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleVote('down');
            }} 
            aria-label="Głos w dół"
            disabled={isVoting}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex flex-wrap items-center gap-1 justify-center sm:justify-end">
          <Button 
            variant={isFavorited ? "default" : "outline"} 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite();
            }}
            aria-label={isFavorited ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
            disabled={isFavoriteLoading}
            className={isFavorited ? "bg-red-500 hover:bg-red-600" : ""}
          >
            <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
          </Button>
          <ShareButton 
            type="deal" 
            itemId={deal.id} 
            title={dealTitle || 'Okazja'} 
            url={`/deals/${deal.id}`} 
            variant="outline" 
            size="sm" 
            onShared={(platform) => handleShareTrack(platform)} 
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toast.success("📢 Będziesz powiadomiony o zmianach ceny!");
            }}
            aria-label="Alert cenowy"
            className="gap-1"
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToComparison({ ...deal, type: 'deal' });
            }}
            aria-label="Dodaj do porównania"
          >
            <Scale className="h-4 w-4" />
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                addDeal(deal, 1);
                toast.success('Dodano okazję do koszyka');
              } catch (err) {
                console.error('addDeal failed', err);
                toast.error('Nie udało się dodać do koszyka');
              }
            }}
            aria-label="Dodaj do koszyka"
            className="gap-1"
          >
            Do koszyka
          </Button>
          {deal.metadata?.isExpired ? (
            <ExpiredDealBadge 
              isExpired={true}
              reason={deal.metadata?.expiryReason || 'Oferta wygasła'}
              checkedAt={deal.metadata?.expiryCheckedAt}
              variant="button"
            />
          ) : (
            <Button size="sm" className="gap-1">
              Przejdź
              <ArrowUp className="h-3 w-3 rotate-90" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
