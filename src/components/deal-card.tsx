// @ts-nocheck
'use client';

import Link from 'next/link';
import Image from 'next/image';
import {useParams, useRouter} from 'next/navigation';
import { withImageProxy } from '@/lib/image-proxy';
import type { Deal, Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { useCategoryName } from '@/hooks/use-category-name';
import { auth } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Flame, MessageSquare, Tag, TrendingUp, Sparkles, Clock, Heart, Truck, Package, Zap, AlertTriangle, ShieldCheck, Star, Info, Scale, Share2, DollarSign, Video, ShoppingCart, Check, MoreVertical, ExternalLink } from "lucide-react";
import React, { useEffect, useState } from 'react';
import { useFormatter } from 'next-intl';
import { toast } from 'sonner';
import { useSmartCart } from '@/lib/cart-context';
import { trackVote, trackFirestoreView, trackFirestoreClick, trackFirestoreShare, trackFirestoreVote } from '@/lib/analytics';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ShareButton from '@/components/share-button';
import { RatingBar } from './rating-bar';
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
import { useUX } from '@/context/UXContext';

interface DealCardProps {
  deal: Deal | any;  // M6: Accept both DealLegacy and M6 Deal formats
  product?: Product | null;
  /** Pass true for first ~4 cards above the fold for LCP priority */
  priority?: boolean;
  layoutMode?: 'grid' | 'masonry' | 'list';
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

function DealCard({ deal, product, priority = false, layoutMode = 'grid', index = 0 }: DealCardProps) {
  const { cardDensity } = useUX();
  const details = cardDensity === 'compact' ? 'compact' : 'expanded';
  // Używaj przekazanego ProductCore jeśli dostępny (spójność z ProductCard)
  const resolvedProduct = product || null;
  const params = useParams();
  const router = useRouter();
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
  const { addDeal, isInCart } = useSmartCart();
  const inCart = isInCart(deal?.id || '');
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
  
  // Prioritize translated product title if deal title is same across all languages (which indicates unrefined/untranslated copy)
  const isDealTitleLocalized = titleObj.pl !== titleObj.en || titleObj.pl !== titleObj.de;
  const productTitleObj = resolvedProduct?.title;
  const activeTitleObj = (!isDealTitleLocalized && productTitleObj) ? productTitleObj : titleObj;
  
  const isDealDescLocalized = descObj.pl !== descObj.en || descObj.pl !== descObj.de;
  const productDescObj = resolvedProduct?.description || resolvedProduct?.shortDescription;
  const activeDescObj = (!isDealDescLocalized && productDescObj) ? productDescObj : descObj;

  const dealTitle = normalizeDisplayText(getText(activeTitleObj) || (activeTitleObj.pl || ''));
  const rawDealDescription = getText(activeDescObj) || (activeDescObj.pl || '');
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
  const productPageUrl = linkedProductId ? `${prefix}/products/${linkedProductId}` : null;
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


  const isList = layoutMode === 'list';
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
        router.push(`${prefix}/deals/${deal.id}`);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          router.push(`${prefix}/deals/${deal.id}`);
        }
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
        isMasonry ? (index % 2 === 0 ? "h-56" : "h-72") : "",
        isMasonry && "bg-sky-500/10 dark:bg-sky-500/5 rounded-xl"
      )}>
        {layoutMode === 'masonry' ? (
          <img 
            src={withImageProxy(coverImage || '/icon_okazjeplus.svg')} 
            alt={dealTitle || 'Okazja'} 
            className="w-full h-full object-cover scale-[1.03] group-hover:scale-105 transition-transform duration-500" 
          />
        ) : (
          <Image 
            src={withImageProxy(coverImage || '/icon_okazjeplus.svg')} 
            alt={dealTitle || 'Okazja'} 
            fill
            sizes="(max-width: 768px) 100vw, 300px"
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            loading={priority ? 'eager' : 'lazy'}
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
              <span>{deal.merchant || deal.metadata?.merchant || deal.source || 'Sklep'}</span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[10px] font-black text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-zinc-700/50 hover:bg-slate-200/80 dark:hover:bg-zinc-700 transition-colors">
                <MessageSquare className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500" />
                <span>{liveComments.count ?? 0}</span>
              </span>
            </div>

            <h4 className="text-xs font-bold line-clamp-2 leading-tight transition-colors group-hover:text-primary">
              {dealTitle}
            </h4>

            {/* List layout extra details reveal on hover */}
            {isList && (
              <div className="max-h-0 opacity-0 overflow-hidden group-hover:max-h-20 group-hover:opacity-100 transition-all duration-300 ease-in-out text-[11px] text-muted-foreground border-t border-border/5 pt-1.5 mt-1">
                <p className="line-clamp-2 leading-relaxed">
                  {decodeHtmlEntities(stripHtmlTags(dealDescription))}
                </p>
              </div>
            )}

            {/* Grid/Masonry Hover Reveal: Description inside the drawer sliding up */}
            {!isList && (
              <div className="max-h-0 opacity-0 overflow-hidden group-hover:max-h-24 group-hover:opacity-100 transition-all duration-300 ease-in-out text-[10px] text-muted-foreground border-t border-border/5 pt-1.5 mt-1">
                <p className={cn("leading-snug", details === 'compact' ? "line-clamp-2" : "line-clamp-3")}>
                  {decodeHtmlEntities(stripHtmlTags(dealDescription))}
                </p>
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
            {priceData.formattedSavings && (
              <div className={cn(
                "text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1.5 leading-none",
                isList && "justify-end"
              )}>
                <span>Zaoszczędź {priceData.formattedSavings}</span>
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
            {/* Left: Voting Widget */}
            <div className="flex items-center">
              <div className="ux-vote-pill" onClick={(e) => e.stopPropagation()}>
                <button 
                  className={cn(
                    "flex items-center justify-center transition-all duration-300 font-black text-xs h-5",
                    (!isList && !isMasonry) ? "w-5" : "w-0 opacity-0 scale-0 group-hover:w-5 group-hover:opacity-100 group-hover:scale-100",
                    userVote === 1 ? "bg-primary text-primary-foreground font-black" : "",
                    "hover:opacity-100 disabled:opacity-50"
                  )}
                  style={{ borderRadius: 'var(--ux-radius-btn)' }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVote('up'); }}
                  disabled={isVoting}
                  title={t('auth.voteUp')}
                >
                  +
                </button>
                <span className="px-1.5 flex items-center gap-0.5 font-extrabold text-xs">
                  <Flame className="h-3.5 w-3.5 shrink-0 animate-pulse text-orange-500" />
                  <span>{temperature}°</span>
                </span>
                <button 
                  className={cn(
                    "flex items-center justify-center transition-all duration-300 font-black text-xs h-5",
                    (!isList && !isMasonry) ? "w-5" : "w-0 opacity-0 scale-0 group-hover:w-5 group-hover:opacity-100 group-hover:scale-100",
                    userVote === -1 ? "bg-red-500 text-white font-black" : "",
                    "hover:opacity-100 disabled:opacity-50"
                  )}
                  style={{ borderRadius: 'var(--ux-radius-btn)' }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVote('down'); }}
                  disabled={isVoting}
                  title={t('auth.voteDown')}
                >
                  -
                </button>
              </div>
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
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToComparison({ ...deal, type: 'deal' }); }}
                title="Porównaj"
              >
                <Scale className="h-3.5 w-3.5" />
              </button>
              <button 
                className={cn("ux-action-btn", inCart && "text-green-600 bg-green-50")}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (inCart) return;
                  try {
                    addDeal(deal, 1);
                    const title = typeof deal.title === 'object' ? (deal.title?.pl || deal.title?.en || '') : (deal.title || '');
                    toast.success(`Dodano do koszyka${title ? ': ' + title.substring(0, 40) : ''}`);
                  } catch (err) {
                    toast.error(t('cart.addToCartError'));
                  }
                }}
                title={inCart ? 'Już w koszyku' : 'Dodaj do koszyka'}
              >
                {inCart ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
              </button>
              {deal.metadata?.isExpired ? (
                <ExpiredDealBadge 
                  isExpired={true}
                  reason={deal.metadata?.expiryReason || t('messages.dealExpired')}
                  checkedAt={deal.metadata?.expiryCheckedAt}
                  variant="button"
                />
              ) : dealExternalUrl ? (
                <button 
                  className="ux-action-btn bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-md opacity-90 hover:opacity-100 hover:scale-110 animate-bounce"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(dealExternalUrl, '_blank', 'noopener,noreferrer');
                  }}
                  title={t('actions.goTo')}
                >
                  <ArrowUp className="h-3.5 w-3.5 rotate-90" />
                </button>
              ) : null}
            </div>
          </div>
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
