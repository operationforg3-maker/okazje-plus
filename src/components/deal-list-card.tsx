import Image from 'next/image';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import type { Deal } from '@/lib/types';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { useCategoryName } from '@/hooks/use-category-name';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VoteControls } from '@/components/vote-controls';
import { Flame, Tag, MessageSquare, Clock, ArrowUp, Sparkles, ShoppingCart, Check, Heart, AlertTriangle, Scale, Package, ExternalLink, ChevronRight, Eye } from 'lucide-react';
import { useSmartCart } from '@/lib/cart-context';
import { useState, useEffect } from 'react';
import { useFormatter } from 'next-intl';
import AdminEditButton from '@/components/admin/admin-edit-button';
import { useCurrency } from '@/lib/unified-currency';
import { extractPriceInfo } from '@/lib/i18n-utils';
import { useCardBaseState } from '@/hooks/use-card-base-state';

import { formatTimeAgo } from '@/lib/format-relative-time';
import ShareButton from '@/components/share-button';
import { toast } from 'sonner';
import { withImageProxy, isAliExpressImage } from '@/lib/image-proxy';
import { getExternalUrl } from '@/lib/external-url';
import { cn } from '@/lib/utils';
import { AuthModal } from '@/components/auth/auth-modal';

interface DealListCardProps {
  deal: Deal | any;  // M6: Accept both DealLegacy and M6 Deal formats
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

function normalizeDisplayText(raw: unknown): string {
  if (!raw) return '';
  const str = safeText(raw);
  if (!str) return '';

  const decoded = decodeHtmlEntities(str);
  const stripped = stripHtmlTags(decoded);
  const parsed = parseLocalizedStringPayload(stripped);
  const final = parsed || stripped;

  return final.replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function resolveDealImage(deal: any): string {
  const candidates = [
    deal?.imageUrl,
    deal?.image,
    deal?.thumbnail,
    deal?.product?.imageUrl,
    deal?.product?.image,
    deal?.metadata?.imageUrl,
    deal?.metadata?.image,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().startsWith('http')) {
      return candidate.trim();
    }
  }

  return '/placeholder.svg';
}

function toTimestampSafe(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
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

export default function DealListCard({ deal, priority = false }: DealListCardProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  const liveComments = useCommentsCount('deals', deal.id, deal.commentsCount, true);
  const { mainName: categoryLabel } = useCategoryName(deal.mainCategorySlug, deal.subCategorySlug, deal.subSubCategorySlug);
  const baseState = useCardBaseState(deal, 'deal', { disableInitialFavoriteCheck: true });
  const { getText, addToComparison, isFavorited, isFavoriteLoading, toggleFavorite, t } = baseState;
  const formatter = useFormatter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [temperature, setTemperature] = useState(deal.temperature || 0);
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalActionType, setAuthModalActionType] = useState<'vote' | 'favorite' | 'alert' | 'comment' | 'general'>('general');
  const [dealData, setDealData] = useState<{
    isNew: boolean;
    relativeTime: string;
    formattedPrice: string | null;
    formattedOriginal: string | null;
    formattedSavings: string | null;
    discount: number | null;
  }>({
    isNew: false,
    relativeTime: '',
    formattedPrice: null,
    formattedOriginal: null,
    formattedSavings: null,
    discount: null,
  });
  
  // Hydration safety - set mounted flag on client
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Get localized deal title and description - handle both LocalizedText objects and legacy strings
  // NOTE: Empty string fallback is intentional - if deal title is missing, it should come from ProductCore
  const titleObj = typeof deal.title === 'object' ? deal.title : { pl: deal.title || '', en: deal.title || '' };
  const descObj = typeof deal.description === 'object' ? deal.description : { pl: deal.description || '', en: deal.description || '' };
  
  const dealTitle = normalizeDisplayText(isMounted ? getText(titleObj) : (titleObj.pl || ''));
  const rawDescription = isMounted ? getText(descObj) : (descObj.pl || '');
  const description = normalizeDisplayText(rawDescription);
  const dealImage = resolveDealImage(deal);
  
  const postedBy = safeText(deal.postedBy, 'Użytkownik');
  const { formatPrice, convertToPLN, currency } = useCurrency();

  const isHot = temperature >= 300;
  const { addDeal, isInCart } = useSmartCart();
  const inCart = isInCart(deal?.id || '');

  const temperatureColor = temperature >= 500 ? 'from-red-500 to-orange-500' 
    : temperature >= 300 ? 'from-orange-500 to-amber-500'
    : temperature >= 100 ? 'from-amber-500 to-yellow-500'
    : 'from-yellow-500 to-green-500';

  const temperaturePercent = Math.min((temperature / 500) * 100, 100);

  const handleVote = async (action: 'up' | 'down') => {
    if (!baseState.user) {
      setAuthModalActionType('vote');
      setAuthModalOpen(true);
      return;
    }

    if (isVoting) return;
    setIsVoting(true);

    const oldTemperature = temperature;
    const oldUserVote = userVote;
    const newVoteValue = action === 'up' ? 1 : -1;

    let tempDelta = 0;
    if (userVote === null) {
      tempDelta = newVoteValue;
      setUserVote(newVoteValue);
    } else if (userVote === newVoteValue) {
      tempDelta = -newVoteValue;
      setUserVote(null);
    } else {
      tempDelta = newVoteValue * 2;
      setUserVote(newVoteValue);
    }

    setTemperature(prev => prev + tempDelta);

    try {
      const { doc, updateDoc, increment } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const dealRef = doc(db, 'deals', deal.id);
      await updateDoc(dealRef, {
        temperature: increment(tempDelta),
      });
      toast.success(action === 'up' ? `Zagłosowano (+${tempDelta > 0 ? tempDelta : 1}°)` : 'Zmniejszono temperaturę');
    } catch (err) {
      setTemperature(oldTemperature);
      setUserVote(oldUserVote);
      toast.error('Błąd głosowania');
    } finally {
      setIsVoting(false);
    }
  };

  // Initialize time-dependent values and format prices on client to fix hydration mismatch
  // M6: Support both legacy (deal.price = number) and new (deal.price = {amount, currency}) formats
  useEffect(() => {
    const isNew = (() => {
      const ts = toTimestampSafe(deal.postedAt);
      if (!ts) return false;
      const diffMs = Date.now() - ts;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays < 3;
    })();

    const relativeTime = formatTimeAgo(deal.postedAt, t);

    const rawPrice = typeof deal.price === 'number' ? deal.price
      : typeof deal.price?.amount === 'number' ? deal.price.amount
      : typeof (deal as any).legacyPrice === 'number' ? (deal as any).legacyPrice
      : typeof (deal as any).currentPrice === 'number' ? (deal as any).currentPrice
      : extractPriceInfo(deal.price).amount;

    const rawOriginal = typeof deal.originalPrice === 'number' ? deal.originalPrice
      : typeof deal.originalPrice?.amount === 'number' ? deal.originalPrice.amount
      : typeof (deal as any).legacyOriginalPrice === 'number' ? (deal as any).legacyOriginalPrice
      : extractPriceInfo(deal.originalPrice).amount;

    const sourceCurrency = (deal.price as any)?.currency || deal.currency || 'PLN';
    const priceInPLN = rawPrice !== null && rawPrice !== undefined ? convertToPLN(rawPrice, sourceCurrency) : null;
    const originalInPLN = rawOriginal !== null && rawOriginal !== undefined ? convertToPLN(rawOriginal, sourceCurrency) : null;

    const formattedPrice = priceInPLN !== null ? formatPrice(priceInPLN) : null;
    const formattedOriginal = originalInPLN !== null && originalInPLN > 0 ? formatPrice(originalInPLN) : null;

    let calculatedDiscount: number | null = null;
    if (priceInPLN !== null && originalInPLN !== null && originalInPLN > priceInPLN) {
      calculatedDiscount = Math.round(((originalInPLN - priceInPLN) / originalInPLN) * 100);
    } else if (typeof deal.discountPercent === 'number') {
      calculatedDiscount = deal.discountPercent;
    }

    let savings: string | null = null;
    if (priceInPLN !== null && originalInPLN !== null && originalInPLN > priceInPLN) {
      const savingsAmount = originalInPLN - priceInPLN;
      savings = formatPrice(savingsAmount);
    }

    setDealData({
      isNew,
      relativeTime,
      formattedPrice,
      formattedOriginal,
      formattedSavings: savings,
      discount: calculatedDiscount,
    });
  }, [deal.postedAt, deal.price, deal.originalPrice, currency]);

  const dealUrl = getExternalUrl(
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
    deal?.product?.sourceUrl
  );

  const linkedProductId =
    (typeof deal?.productCoreId === 'string' && deal.productCoreId) ||
    (typeof deal?.product?.id === 'string' && deal.product.id) ||
    (Array.isArray(deal?.linkedProductIds) && typeof deal.linkedProductIds[0] === 'string' ? deal.linkedProductIds[0] : '');
  const productPageUrl = linkedProductId ? `${prefix}/products/${linkedProductId}` : null;

  // Generate responsive image URL with size params for proxy optimization
  const imageUrl = withImageProxy(dealImage);

  // Subtle ambient temperature background glow & border styling
  const ambientBgStyle = temperature >= 500
    ? 'bg-gradient-to-r from-red-500/10 via-orange-500/5 to-card dark:from-red-500/15 dark:via-orange-500/8 dark:to-card border-orange-500/35 dark:border-orange-500/45 hover:border-orange-500/60'
    : temperature >= 300
    ? 'bg-gradient-to-r from-orange-500/8 via-amber-500/4 to-card dark:from-orange-500/12 dark:via-amber-500/6 dark:to-card border-amber-500/30 dark:border-amber-500/40 hover:border-amber-500/50'
    : temperature >= 100
    ? 'bg-gradient-to-r from-amber-500/4 via-yellow-500/2 to-card dark:from-amber-500/6 dark:via-yellow-500/3 dark:to-card border-amber-500/20 dark:border-amber-500/25 hover:border-amber-500/35'
    : 'bg-card hover:bg-card/95 border-border/60 hover:border-border';

  return (
    <div className={cn(
      "group relative flex flex-row rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 w-full",
      ambientBgStyle
    )}>
      
      {/* Left: Image */}
      <Link
        href={`${prefix}/deals/${deal.id}`}
        className="relative flex-shrink-0 w-32 sm:w-44 md:w-48 bg-muted/30 flex items-center justify-center overflow-hidden group/img"
      >
        <div className="relative w-full h-full min-h-[120px]">
          <Image
            src={imageUrl}
            alt={dealTitle || 'Okazja'}
            data-ai-hint={safeText(deal.imageHint)}
            fill
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            sizes="(max-width: 640px) 128px, (max-width: 768px) 176px, 192px"
            quality={75}
            className="object-contain p-2 transition-transform duration-500 group-hover/img:scale-105"
            unoptimized={isAliExpressImage(dealImage)}
          />
        </div>

        {/* Discount badge on image */}
        {typeof dealData.discount === 'number' && dealData.discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[11px] font-black px-1.5 py-0.5 rounded-md leading-none">
            -{dealData.discount}%
          </div>
        )}
        {isHot && (
          <div className="absolute bottom-2 left-2 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 leading-none">
            <Flame className="h-2.5 w-2.5 fill-current" />
            Hot
          </div>
        )}

        {/* Admin Edit */}
        <div className="absolute right-1.5 bottom-1.5 z-10">
          <AdminEditButton
            onClick={() => setEditDialogOpen(true)}
            className="h-7 w-7 rounded-full bg-background/90 shadow-sm hover:bg-background border border-border"
            tooltip="Edytuj deal (admin)"
          />
        </div>
      </Link>

      {/* Center: Content */}
      <div className="flex flex-col flex-grow min-w-0 px-3 py-3 gap-2 justify-between">
        {/* Top Row: merchant + category + time on left | Price block on right */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {deal.merchant && (
              <span className="font-semibold text-foreground bg-accent/50 px-1.5 py-0.5 rounded text-[11px]">
                {deal.merchant}
              </span>
            )}
            {categoryLabel && (
              <Badge variant="secondary" className="flex items-center gap-0.5 text-[10px] font-medium h-4 px-1.5 py-0">
                <Tag className="h-2.5 w-2.5" aria-hidden />
                {categoryLabel}
              </Badge>
            )}
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {dealData.relativeTime}
            </span>
          </div>

          {/* Price Block */}
          <div className="flex flex-col items-end text-right shrink-0">
            <p className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-none">
              {dealData.formattedPrice || 'N/A'}
            </p>
            {dealData.formattedOriginal && (
              <div className="flex items-center gap-1.5 text-xs mt-0.5">
                <span className="text-muted-foreground/70 line-through font-medium">
                  {dealData.formattedOriginal}
                </span>
                {dealData.formattedSavings && (
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                    -{dealData.formattedSavings}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <div>
          <Link href={`${prefix}/deals/${deal.id}`} className="group/title block">
            <h3 className="font-headline text-sm sm:text-base font-bold text-foreground group-hover/title:text-primary transition-colors line-clamp-2 leading-snug">
              {dealTitle}
            </h3>
          </Link>

          {description && (
            <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-1 leading-relaxed mt-1 hidden sm:block">
              {description}
            </p>
          )}
        </div>

        {/* Bottom: temperature pill + comments count + 5 Action Buttons (identical to grid card) */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-border/30">
          <div className="flex items-center gap-2">
            {/* Interactive Vote pill with +/- buttons */}
            <div className="ux-vote-pill" onClick={(e) => e.stopPropagation()}>
              <button 
                className={cn(
                  "flex items-center justify-center transition-all duration-300 font-black text-xs h-5 overflow-hidden",
                  userVote === 1 ? "w-5 bg-primary text-primary-foreground font-black opacity-100 scale-100" : "w-0 opacity-0 scale-0 group-hover:w-5 group-hover:opacity-100 group-hover:scale-100",
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
                  "flex items-center justify-center transition-all duration-300 font-black text-xs h-5 overflow-hidden",
                  userVote === -1 ? "w-5 bg-red-500 text-white font-black opacity-100 scale-100" : "w-0 opacity-0 scale-0 group-hover:w-5 group-hover:opacity-100 group-hover:scale-100",
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

            {/* Comments Count Badge */}
            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span>{liveComments.count}</span>
            </span>
          </div>

          {/* Action icons row - 100% identical to grid card */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(); }}
              className={cn("ux-action-btn", isFavorited && "text-red-500 bg-red-500/10 opacity-100")}
              aria-label={isFavorited ? t('auth.removeFromFavorites') : t('auth.addToFavorites')}
              disabled={isFavoriteLoading}
              title={isFavorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            >
              <Heart className={cn("h-3.5 w-3.5", isFavorited && "fill-current")} />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToComparison({ ...deal, type: 'deal' }); }}
              className="ux-action-btn"
              aria-label={t('comparison.addToComparison')}
              title="Porównaj"
            >
              <Scale className="h-3.5 w-3.5" />
            </button>
            <ShareButton
              type="deal"
              itemId={deal.id}
              title={dealTitle || t('labels.deal')}
              url={`/deals/${deal.id}`}
              variant="ghost"
              size="icon"
              className="ux-action-btn"
            />
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (inCart) return;
                try {
                  addDeal(deal, 1);
                  toast.success(`Dodano do koszyka${dealTitle ? ': ' + dealTitle.substring(0, 40) : ''}`);
                } catch (err) {
                  toast.error('Błąd dodawania do koszyka');
                }
              }}
              className={cn("ux-action-btn", inCart && "text-emerald-500 bg-emerald-500/10 opacity-100")}
              aria-label={inCart ? 'Już w koszyku' : 'Dodaj do koszyka'}
              title={inCart ? 'Już w koszyku' : 'Dodaj do koszyka'}
            >
              {inCart ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
            </button>
            {dealUrl && (
              <button
                className="ux-action-btn bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/35 border border-orange-400/30 opacity-95 hover:opacity-100 hover:scale-110 animate-bounce transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(dealUrl, '_blank', 'noopener,noreferrer');
                }}
                title={t('actions.goTo')}
              >
                <ArrowUp className="h-3.5 w-3.5 rotate-90 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        actionType={authModalActionType}
      />
    </div>
  );
}
