// @ts-nocheck
'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import type { Deal, Product } from '@/lib/types';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { useCategoryName } from '@/hooks/use-category-name';
import { auth } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Flame, MessageSquare, Tag, TrendingUp, Sparkles, Clock, Heart, Truck, Package, Zap, AlertTriangle, ShieldCheck, Star, Info, Scale, Share2, DollarSign, Video, ShoppingCart } from "lucide-react";
import React, { useEffect, useState } from 'react';
import { useFormatter } from 'next-intl';
import { toast } from 'sonner';
import { useSmartCart } from '@/lib/cart-context';
import { trackVote, trackFirestoreView, trackFirestoreClick, trackFirestoreShare, trackFirestoreVote } from '@/lib/analytics';
import ShareButton from '@/components/share-button';
import { RatingBar } from '../rating-bar';
import { AdminQuickActions } from '@/components/admin/admin-quick-actions';
// import DealEditDialog from '@/components/admin/deal-edit-dialog';
import { ExpiredDealBadge } from '@/components/expired-deal-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCurrency } from '@/lib/unified-currency';
import { extractPriceInfo, getDiscountPercent } from '@/lib/i18n-utils';
import { CategoryBreadcrumb } from '@/components/category-breadcrumb';
import { useCardBaseState } from '@/hooks/use-card-base-state';
import { CardHeader } from '@/components/ui/card-header';
import { getExternalUrl } from '@/lib/external-url';
import { Sparkline, generateSmartBadges } from '@/components/product/Sparkline';
import { SpecsTeaserInline } from '@/components/product/SpecificationsTable';

interface DealCardProps {
  deal: Deal | any;  // M6: Accept both DealLegacy and M6 Deal formats
  product?: Product | null;
  /** Pass true for first ~4 cards above the fold for LCP priority */
  priority?: boolean;
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

const stripHtmlTags = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const parseLocalizedStringPayload = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const tryExtractFromObject = (obj: Record<string, unknown>): string => {
    const preferred = [obj.pl, obj.en, obj.de, ...Object.values(obj)]
      .find((entry) => typeof entry === 'string' && String(entry).trim().length > 0);
    return typeof preferred === 'string' ? preferred : '';
  };

  const tryParse = (input: string): string => {
    try {
      const parsed = JSON.parse(input);
      if (typeof parsed === 'string' && parsed !== input) return tryParse(parsed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return tryExtractFromObject(parsed as Record<string, unknown>);
      }
    } catch {
      // ignored on purpose
    }
    return '';
  };

  return tryParse(trimmed) || trimmed;
};

const normalizeDisplayText = (value: unknown): string => {
  const asString = safeText(value, '');
  const parsed = parseLocalizedStringPayload(asString);
  return stripHtmlTags(decodeHtmlEntities(parsed));
};

const resolveImageCandidate = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = resolveImageCandidate(entry);
      if (resolved) return resolved;
    }
    return undefined;
  }
  if (typeof value === 'object') {
    const candidate = (value as any).src || (value as any).url || (value as any).image || (value as any).imageUrl;
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : undefined;
  }
  return undefined;
};

const resolveDealImage = (deal: any, product?: Product | null): string => {
  const candidates = [
    deal?.image,
    deal?.imageUrl,
    deal?.mainImage,
    deal?.product_main_image_url,
    deal?.thumbnail,
    deal?.images,
    deal?.gallery,
    deal?.metadata?.image,
    deal?.metadata?.imageUrl,
    deal?.metadata?.mainImage,
    deal?.importMetadata?.image,
    deal?.importMetadata?.imageUrl,
    deal?.importMetadata?.mainImage,
    product?.images,
    (product as any)?.image,
    (product as any)?.imageUrl,
  ];

  for (const candidate of candidates) {
    const resolved = resolveImageCandidate(candidate);
    if (resolved) return resolved;
  }

  return '/icon_okazjeplus.svg';
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

function DealCard({ deal, product, priority = false }: DealCardProps) {
  // Używaj przekazanego ProductCore jeśli dostępny (spójność z ProductCard)
  const resolvedProduct = product || null;
  const params = useParams();
  const localeFromParams = (params?.locale as string) || 'pl';
  const [locale, setLocale] = useState(localeFromParams);
  const prefix = `/${locale}`;
  const baseState = useCardBaseState(deal, 'deal', { disableInitialFavoriteCheck: true });
  const { getText, addToComparison, user, isFavorited, isFavoriteLoading, toggleFavorite, t } = baseState;
  const formatter = useFormatter();
  const liveComments = useCommentsCount('deals', deal.id, deal.commentsCount, true);
  const { mainName: categoryLabel } = useCategoryName(
    deal.mainCategorySlug || resolvedProduct?.mainCategorySlug,
    deal.subCategorySlug || resolvedProduct?.subCategorySlug,
    deal.subSubCategorySlug || resolvedProduct?.subSubCategorySlug
  );
  // Usunięto wywołanie useCoupons - dane kuponów powinny być już w Firestore
  const [temperature, setTemperature] = useState(deal.temperature);
  const [voteCount, setVoteCount] = useState(deal.voteCount);
  const [isVoting, setIsVoting] = useState(false);
  const [userVote, setUserVote] = useState<1 | -1 | null>(null); // Śledzimy głos użytkownika
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isNew, setIsNew] = useState(false); // Will be calculated in useEffect
  const [relativeTime, setRelativeTime] = useState(''); // Will be calculated in useEffect
  const { currency, formatPrice, convertToPLN } = useCurrency();
  const { addDeal } = useSmartCart();
  const isPromotionDeal = deal?.dealType === 'coupon' || deal?.metadata?.promotionType === 'offer';
  const offerPreviewUrl = deal?.metadata?.offerPreviewUrl || deal?.metadata?.previewUrl || deal?.sourceUrl || deal?.link;
  
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

  // Sync locale when route param changes
  useEffect(() => {
    setLocale(localeFromParams);
  }, [localeFromParams]);

  // Format prices on client only (using unified currency system)
  // M6: Support both legacy (deal.price = number) and new (deal.price = {amount, currency}) formats
  useEffect(() => {
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
    const priceInPLN = convertToPLN(safePrice, sourceCurrency);
    const formatted = formatPrice(priceInPLN);

    let formattedOrig: string | null = null;
    let calculatedDiscount: number | null = null;
    let savings: string | null = null;
    let shipping: string | null = null;

    if (typeof deal.originalPrice === 'number') {
      const origInPLN = convertToPLN(deal.originalPrice, sourceCurrency);
      formattedOrig = formatPrice(origInPLN);

      if (deal.originalPrice > 0) {
        calculatedDiscount = Math.round(100 - (safePrice / deal.originalPrice) * 100);
      }

      if (deal.originalPrice > safePrice) {
        const savingsInPLN = origInPLN - priceInPLN;
        savings = formatPrice(savingsInPLN);
      }
    }

    if (typeof deal.shippingCost === 'number' && deal.shippingCost > 0) {
      const shippingInPLN = convertToPLN(deal.shippingCost, sourceCurrency);
      shipping = formatPrice(shippingInPLN);
    }

    const fallbackDiscount = typeof deal.discountPercent === 'number' ? deal.discountPercent : null;

    setPriceData({
      formattedPrice: formatted,
      formattedOriginal: formattedOrig,
      formattedSavings: savings,
      formattedShippingCost: shipping,
      discount: calculatedDiscount ?? fallbackDiscount,
    });
  }, [currency, deal.price, deal.originalPrice, deal.shippingCost]);
  const postedBy = safeText(deal.postedBy, 'Użytkownik');

  const coverImage = resolveDealImage(deal, resolvedProduct);
  const gallery = Array.isArray(deal.gallery) && deal.gallery.length > 0
    ? deal.gallery
    : (resolvedProduct?.images || (coverImage ? [coverImage] : []));
  
  // Get localized deal title and description - use safe defaults to prevent hydration mismatch
  // Handle both LocalizedText and legacy string formats
  // NOTE: Empty string fallback is intentional - if deal title is missing, it should come from ProductCore
  const titleObj = typeof deal.title === 'object' ? deal.title : { pl: deal.title || '', en: deal.title || '' };
  const descObj = typeof deal.description === 'object' ? deal.description : { pl: deal.description || '', en: deal.description || '' };
  
  const dealTitle = normalizeDisplayText(getText(titleObj) || (titleObj.pl || ''));
  const rawDealDescription = getText(descObj) || (descObj.pl || '');
  const dealDescription = normalizeDisplayText(rawDealDescription);
  
  const couponCode = safeText(deal.couponCode);
  const promotionCampaign = deal?.metadata?.promotionCampaign || deal?.importMetadata?.promotionCampaign;
  const promotionLabel = safeText(promotionCampaign?.label || promotionCampaign?.name);
  const promotionEndsAt = safeText(promotionCampaign?.endAt);
  const promotionAppPrice = typeof promotionCampaign?.price?.appSale === 'number'
    ? promotionCampaign.price.appSale
    : undefined;
  const deliveryTime = safeText(deal.importMetadata?.deliveryTime);
  const warehouseInfo = safeText(deal.importMetadata?.warehouse);
  const returnPolicy = safeText(deal.importMetadata?.returnPolicy);

  const linkedProductId =
    (typeof (resolvedProduct as any)?.id === 'string' && (resolvedProduct as any).id) ||
    (typeof deal?.productCoreId === 'string' && deal.productCoreId) ||
    (typeof deal?.product?.id === 'string' && deal.product.id) ||
    (Array.isArray(deal?.linkedProductIds) && typeof deal.linkedProductIds[0] === 'string' ? deal.linkedProductIds[0] : '');
  const productPageUrl = linkedProductId ? `${prefix}/new-ux/products/${linkedProductId}` : null;
  const dealExternalUrl = getExternalUrl(
    deal?.link,
    deal?.affiliateLink,
    deal?.affiliateUrl,
    deal?.dealUrl,
    deal?.sourceUrl,
    deal?.url,
    deal?.externalUrl,
    deal?.metadata?.offerPreviewUrl,
    deal?.metadata?.previewUrl,
    deal?.metadata?.offerUrl,
    deal?.metadata?.externalUrl,
    deal?.metadata?.url,
    deal?.product?.link,
    deal?.product?.affiliateLink,
    deal?.product?.sourceUrl,
    (resolvedProduct as any)?.sourceLinks?.[0]?.url,
    (resolvedProduct as any)?.sourceLinks?.[0]?.link
  );

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
  
  // Deep Data Smart Badges — odczytaj z priceHistory i logistics
  const _rawPrice = typeof deal.price === 'number' ? deal.price
    : typeof deal.price?.amount === 'number' ? deal.price.amount
    : typeof deal.legacyPrice === 'number' ? deal.legacyPrice
    : 0;
  const deepDataBadges = generateSmartBadges({
    price: {
      current: _rawPrice,
      lowest30d: deal.lowestPriceIn30Days,
    },
    logistics: product?.logistics,
    priceHistory: deal.priceHistory,
  });

  const handleVote = async (action: 'up' | 'down') => {
    if (!user) {
      toast.error(t('auth.loginToVote'));
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
        throw new Error(t('auth.sessionExpired'));
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
        throw new Error(data.message || t('messages.voteError'));
      }

      setTemperature(data.temperature);
      setVoteCount(data.voteCount);
      setUserVote(data.userVote);
      
      trackVote('deal', deal.id, action);
      void trackFirestoreVote('deal', deal.id, user.uid, action);

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([50]);
      }
      
      toast.success(t('messages.thankYouForVote'));
    } catch (error: any) {
      setTemperature(oldTemperature);
      setVoteCount(oldVoteCount);
      setUserVote(oldUserVote);
      
      toast.error(error.message || t('errors.voteError'));
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
    const ts = toTimestampSafe(deal.postedAt);
    if (ts) {
      try {
        setRelativeTime(formatter.relativeTime(new Date(ts), new Date()));
      } catch (err) {
        setRelativeTime('');
      }
    }
  }, [deal.postedAt, formatter]);


  return (
    <div 
      className="group relative flex h-full flex-col overflow-hidden cursor-pointer rounded-2xl border border-border/30 bg-background/50 backdrop-blur-md shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/20"
      onClick={() => {
        window.location.href = `${prefix}/new-ux/deals/${deal.id}`;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          window.location.href = `${prefix}/new-ux/deals/${deal.id}`;
        }
      }}
      role="link"
      tabIndex={0}
    >
      {/* Image container & overlay badge details for Hot Deal style */}
      <div className="relative aspect-[4/3] sm:aspect-square bg-muted/10 border-b border-border/30 overflow-hidden group-hover:bg-muted/20 transition-all duration-300">
        <Image
          src={withImageProxy(coverImage || '/icon_okazjeplus.svg')}
          alt={dealTitle || 'Okazja'}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
          loading={priority ? 'eager' : 'lazy'}
        />

        {/* Dynamic float temperature tag on image */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          {isHot && (
            <div className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-xs px-3 py-1.5 rounded-2xl shadow-md border border-orange-400/20">
              <Flame className="h-4 w-4 animate-bounce" />
              <span>{temperature}°</span>
            </div>
          )}
          {discount > 0 && (
            <div className="bg-red-500 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-md w-fit">
              -{discount}%
            </div>
          )}
        </div>

        {/* Favorite overlay button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-10 bg-background/80 backdrop-blur-md hover:bg-background shadow-md h-9 w-9 rounded-full border border-border/40"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite();
          }}
          disabled={isFavoriteLoading}
        >
          <Heart className={`h-4.5 w-4.5 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
        </Button>

        {/* Extra indicators */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
          {deal.freeShipping && (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] font-bold py-0.5 px-2 rounded-lg">
              Darmowa dostawa
            </Badge>
          )}
        </div>

        {/* Admin Quick Actions */}
        <div className="absolute right-3 bottom-3 z-10">
          <AdminQuickActions
            productId={deal.product?.id || deal.id} 
            itemType="deal"
            onEdit={() => setEditDialogOpen(true)}
          />
        </div>
      </div>
      
      <div className="flex-grow space-y-2.5 p-4 sm:p-5 min-w-0">
        {/* Category Breadcrumb & Time */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <CategoryBreadcrumb
            mainCategorySlug={deal.mainCategorySlug}
            subCategorySlug={deal.subCategorySlug}
            subSubCategorySlug={deal.subSubCategorySlug}
            className="flex-grow"
          />
          <div className="flex items-center gap-1 flex-shrink-0 text-muted-foreground/80">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-xs font-medium">{relativeTime}</span>
          </div>
        </div>

        <h3 className="font-headline text-base sm:text-lg font-bold leading-tight transition-colors group-hover:text-primary line-clamp-2">
          {dealTitle}
        </h3>
        
        {/* Specs Teaser */}
        {resolvedProduct?.specificationsStructured && resolvedProduct.specificationsStructured.length > 0 && (
          <SpecsTeaserInline specifications={resolvedProduct.specificationsStructured} maxSpecs={2} />
        )}
        
        {/* Smart Badges */}
        {deepDataBadges && deepDataBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {deepDataBadges.filter(badge => badge && badge.text).map((badge, idx) => {
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
                  className="text-white text-[10px] px-2 py-0.5 font-bold"
                  style={{ backgroundColor: getBadgeColor(badge.color) }}
                >
                  {String(badge.text)}
                </Badge>
              );
            })}
          </div>
        )}
        
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {dealDescription}
        </p>
        
        {/* Sparkline Price Trend */}
        {deal.priceHistory && Array.isArray(deal.priceHistory) && deal.priceHistory.length > 1 && (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Trend ceny:</span>
            <Sparkline data={deal.priceHistory} width={80} height={16} />
          </div>
        )}

        {/* Enhanced Metadata Row */}
        {(hasRealShipping || warrantyInfo.available || specifications.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {hasRealShipping && shippingInfo.cost > 0 && (
              <Badge variant="outline" className="text-[10px] font-medium border-border/80 bg-background/50">
                <Truck className="w-3 h-3 mr-1 text-muted-foreground" />
                Dostawa: {formatPrice(shippingInfo.cost)}
              </Badge>
            )}
            {hasRealShipping && shippingInfo.estimatedDays && (
              <Badge variant="outline" className="text-[10px] font-medium border-border/80 bg-background/50">
                <Clock className="w-3 h-3 mr-1 text-muted-foreground" />
                ~{shippingInfo.estimatedDays} dni
              </Badge>
            )}
            {warrantyInfo.available && (
              <Badge variant="outline" className="text-[10px] font-medium border-border/80 bg-background/50">
                <ShieldCheck className="w-3 h-3 mr-1 text-muted-foreground" />
                Gwarancja
              </Badge>
            )}
            {specifications.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] font-medium border-border/80 bg-background/50 cursor-help">
                      <Info className="w-3 h-3 mr-1 text-muted-foreground" />
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

        {/* Commission Info */}
        {commission && user?.role === 'admin' && (
          <Badge variant="secondary" className="text-[10px] w-fit gap-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
            <DollarSign className="h-3 w-3" />
            Prowizja: {commission}%
          </Badge>
        )}

        {/* Szczegóły dostawy */}
        <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {deal.metadata?.dealTags && deal.metadata.dealTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {deal.metadata.dealTags.slice(0, 2).map((tag: string, idx: number) => (
                <Badge key={idx} variant="outline" className="text-[9px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {deal.metadata?.flashSale?.active && (
            <Badge variant="destructive" className="bg-orange-600 animate-pulse text-[10px] px-2 py-0">
              <Zap className="h-3 w-3 mr-1" />
              Flash Sale
            </Badge>
          )}
          {promotionAppPrice !== undefined && promotionAppPrice > 0 && (
            <Badge variant="outline" className="text-[10px] border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 px-1.5 py-0">
              W app: {formatPrice(promotionAppPrice)}
            </Badge>
          )}
          {promotionEndsAt && (
            <span className="flex items-center gap-1 font-medium">
              <Clock className="h-3 w-3" />
              Do: {new Date(promotionEndsAt).toLocaleDateString('pl-PL')}
            </span>
          )}
        </div>

        {/* Sekcja ceny */}
        <div className="pt-2 border-t border-border/20">
          {isPromotionDeal ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs px-2 py-0.5 font-bold">{t('labels.promoCoupon')}</Badge>
              {deal?.metadata?.hasCoupons && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">{t('labels.couponsAvailable')}</Badge>
              )}
            </div>
          ) : (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-black text-foreground tracking-tight">{priceData.formattedPrice || 'N/A'}</span>
              {priceData.formattedOriginal && (
                <span className="text-sm text-muted-foreground line-through decoration-muted-foreground/50">{priceData.formattedOriginal}</span>
              )}
              {typeof priceData.discount === 'number' && priceData.discount > 0 && (
                <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/10">
                  -{priceData.discount}%
                </span>
              )}
              {priceData.formattedSavings ? (
                <span className="ml-auto text-xs font-bold text-green-600">{t('labels.youSave', { amount: priceData.formattedSavings })}</span>
              ) : (
                typeof priceData.discount === 'number' && priceData.discount > 0 && (
                  <span className="ml-auto text-xs font-bold text-green-600">{t('labels.discount', { percent: priceData.discount })}</span>
                )
              )}
            </div>
          )}
        </div>

        {/* Temperature bar */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Flame className="h-3.5 w-3.5" />
              {t('labels.temperature')}
            </span>
            <span className="font-bold text-foreground">{temperature} pkt</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
            <div 
              className={`h-full bg-gradient-to-r ${temperatureColor} transition-all duration-500`}
              style={{ width: `${temperaturePercent}%` }}
            />
          </div>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t bg-muted/30 p-2 sm:p-3">
        <div className="flex items-center gap-1 justify-center sm:justify-start">
          <Button 
            variant={userVote === 1 ? "default" : "outline"} 
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleVote('up');
            }} 
            aria-label={t('auth.voteUp')}
            disabled={isVoting}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button 
            variant={userVote === -1 ? "default" : "outline"} 
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleVote('down');
            }} 
            aria-label={t('auth.voteDown')}
            disabled={isVoting}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex flex-wrap items-center gap-1 justify-center sm:justify-end">
          {isPromotionDeal && offerPreviewUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
            >
              <a
                href={offerPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {t('labels.dealPreview')}
              </a>
            </Button>
          )}
          <Button 
            variant={isFavorited ? "default" : "outline"} 
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite();
            }}
            aria-label={isFavorited ? t('auth.removeFromFavorites') : t('auth.addToFavorites')}
            disabled={isFavoriteLoading}
            className={isFavorited ? "bg-red-500 hover:bg-red-600" : ""}
          >
            <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
          </Button>
          <ShareButton 
            type="deal" 
            itemId={deal.id} 
            title={dealTitle || t('labels.deal')} 
            url={`/new-ux/deals/${deal.id}`} 
            variant="outline" 
            size="icon"
            onShared={(platform) => handleShareTrack(platform)} 
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toast.success(t('messages.priceAlertEnabled'));
            }}
            aria-label={t('auth.priceAlert')}
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addToComparison({ ...deal, type: 'deal' });
            }}
            aria-label={t('comparison.addToComparison')}
          >
            <Scale className="h-4 w-4" />
          </Button>
          <Button 
            variant="default" 
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                addDeal(deal, 1);
                toast.success(t('messages.dealAddedToCart'));
              } catch (err) {
                console.error('addDeal failed', err);
                toast.error(t('cart.addToCartError'));
              }
            }}
            aria-label={t('cart.addToCart')}
            className="h-11 w-11"
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
          {deal.metadata?.isExpired ? (
            <ExpiredDealBadge 
              isExpired={true}
              reason={deal.metadata?.expiryReason || t('messages.dealExpired')}
              checkedAt={deal.metadata?.expiryCheckedAt}
              variant="button"
            />
          ) : dealExternalUrl ? (
            <Button asChild size="icon" className="h-11 w-11 bg-emerald-600 hover:bg-emerald-700 text-white" aria-label={t('actions.goTo')}>
              <a href={dealExternalUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <ArrowUp className="h-4 w-4 rotate-90" />
              </a>
            </Button>
          ) : (
            <Button size="icon" className="h-11 w-11 bg-emerald-600 text-white opacity-80" aria-label={t('actions.goTo')} disabled>
              <ArrowUp className="h-4 w-4 rotate-90" />
            </Button>
          )}
          {productPageUrl && (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label={t('labels.viewProduct')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Link href={productPageUrl}>
                <Package className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const DealCardMemo = React.memo(
  DealCard,
  (prevProps, nextProps) => {
    const sameId = prevProps.deal?.id === nextProps.deal?.id;
    const sameTemp = prevProps.deal?.temperature === nextProps.deal?.temperature;
    const sameVotes = prevProps.deal?.voteCount === nextProps.deal?.voteCount;
    const sameProduct = prevProps.product?.id === nextProps.product?.id;
    return sameId && sameTemp && sameVotes && sameProduct;
  }
);

export default DealCardMemo;
