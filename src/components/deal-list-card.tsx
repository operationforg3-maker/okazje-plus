import Image from 'next/image';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import type { Deal } from '@/lib/types';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { useCategoryName } from '@/hooks/use-category-name';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VoteControls } from '@/components/vote-controls';
import { Flame, Tag, MessageSquare, Clock, ArrowUp, Sparkles, ShoppingCart, Heart, AlertTriangle, Scale, Package } from 'lucide-react';
import { useSmartCart } from '@/lib/cart-context';
import { useState, useEffect } from 'react';
import { useFormatter } from 'next-intl';
import AdminEditButton from '@/components/admin/admin-edit-button';
import { useCurrency } from '@/lib/unified-currency';
import { extractPriceInfo } from '@/lib/i18n-utils';
import { useCardBaseState } from '@/hooks/use-card-base-state';
import ShareButton from '@/components/share-button';
import { toast } from 'sonner';
import { withImageProxy, isAliExpressImage } from '@/lib/image-proxy';
import { getExternalUrl } from '@/lib/external-url';

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

const resolveDealImage = (deal: any): string => {
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

  const isHot = deal.temperature >= 300;
  const { addDeal } = useSmartCart();

  const temperatureColor = deal.temperature >= 500 ? 'from-red-500 to-orange-500' 
    : deal.temperature >= 300 ? 'from-orange-500 to-amber-500'
    : deal.temperature >= 100 ? 'from-amber-500 to-yellow-500'
    : 'from-yellow-500 to-green-500';

  const temperaturePercent = Math.min((deal.temperature / 500) * 100, 100);

  // Initialize time-dependent values and format prices on client to fix hydration mismatch
  // M6: Support both legacy (deal.price = number) and new (deal.price = {amount, currency}) formats
  useEffect(() => {
    const posted = new Date(deal.postedAt);
    const now = new Date();
    const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
    const isNewDeal = diffDays <= 7;
    
    let relTime = '';
    const ts = toTimestampSafe(deal.postedAt);
    if (ts) {
      try {
        relTime = formatter.relativeTime(new Date(ts), new Date());
      } catch (err) {}
    }
    
    // Format prices using unified currency system
    const userCurrency = currency || 'PLN';
    
    // M6 compatibility: Robust extraction
    const { amount: priceAmount, currency: extractedCurrency } = extractPriceInfo(deal.price, deal.legacyPrice);
    const sourceCurrency = (extractedCurrency || 'PLN').toUpperCase() as any;

    const safePrice = Number(priceAmount) || 0;
    
    // Ensure we work with PLN for CurrencyManager
    const priceInPLN = convertToPLN(safePrice, sourceCurrency);
    const formatted = formatPrice(priceInPLN);
    
    let formattedOrig: string | null = null;
    let calculatedDiscount: number | null = null;
    let savings: string | null = null;
    
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
    
    setDealData({
      isNew: isNewDeal,
      relativeTime: relTime,
      formattedPrice: formatted,
      formattedOriginal: formattedOrig,
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

  return (
    <div className="group relative flex flex-col sm:flex-row rounded-2xl border border-border/40 bg-background/60 backdrop-blur-md p-3 sm:p-4 md:p-5 items-stretch gap-3 sm:gap-5 w-full shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <Link href={`${prefix}/deals/${deal.id}`} className="relative flex-shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted/40">
        <div className="relative w-full sm:w-32 md:w-40 h-48 sm:h-24 md:h-32 bg-muted/50">
          <Image
            src={imageUrl}
            alt={dealTitle || 'Okazja'}
            data-ai-hint={safeText(deal.imageHint)}
            fill
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            sizes="160px"
            quality={55}
            className="object-contain transition-transform duration-300 group-hover:scale-105"
            unoptimized={isAliExpressImage(dealImage)}
          />
        </div>
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {isHot && (
            <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg text-xs">
              <Flame className="mr-1 h-3 w-3" />
              Hot
            </Badge>
          )}
          {/* Social Proof Badge (List Mode) */}
          {((deal as any)?.marketing?.ordersCount || 0) > 10 && (
              <div className="bg-red-600/90 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm flex items-center gap-1 shadow-sm w-fit">
                <Flame className="w-3 h-3" />
                <span className="font-medium whitespace-nowrap">
                  {t('labels.boughtCount', { count: ((deal as any)?.marketing?.ordersCount || 0) })}
                </span>
              </div>
          )}
          {dealData.isNew && (
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg text-xs">
              <Sparkles className="mr-1 h-3 w-3" />
              {t('labels.isNew')}
            </Badge>
          )}
        </div>
        
        {/* Admin Edit Button - prawy dolny róg obrazka */}
        <div className="absolute right-2 bottom-2">
          <AdminEditButton
            onClick={() => setEditDialogOpen(true)}
            className="h-11 w-11 rounded-full bg-white/90 shadow-md hover:bg-white"
            tooltip="Edytuj deal (admin)"
          />
        </div>
      </Link>
      
      {/* Edit Dialog */}
      {/* <DealEditDialog
        deal={deal}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      /> */}
      
      <div className="flex flex-col flex-grow min-w-0 justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Link href={`${prefix}/deals/${deal.id}`} className="group/title">
              <h3 className="font-headline text-xl font-semibold group-hover/title:text-primary transition-colors line-clamp-2">
                {dealTitle}
              </h3>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dealData.relativeTime}
            </span>
            <span aria-hidden>•</span>
            <span>
              {t('labels.by')} <span className="font-medium text-foreground">{postedBy}</span>
            </span>
            {categoryLabel && (
              <>
                <span aria-hidden>•</span>
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Tag className="h-3 w-3" aria-hidden />
                  {categoryLabel}
                </Badge>
              </>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>

          {/* Temperature bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Flame className="h-3 w-3" />
                {t('labels.temperature')}
              </span>
              <span className="font-semibold">{deal.temperature} pkt</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div 
                className={`h-full bg-gradient-to-r ${temperatureColor} transition-all duration-500`}
                style={{ width: `${temperaturePercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-2xl font-bold text-primary">{dealData.formattedPrice || 'N/A'}</p>
            {dealData.formattedOriginal && (
              <p className="text-base text-muted-foreground line-through">{dealData.formattedOriginal}</p>
            )}
            {typeof dealData.discount === 'number' && dealData.discount > 0 && (
              <Badge variant="destructive">-{dealData.discount}%</Badge>
            )}
            {dealData.formattedSavings && (
              <span className="text-xs font-semibold text-green-600">{t('labels.youSave', { amount: dealData.formattedSavings })}</span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1" title={t('labels.votes')}>
              <ArrowUp className="h-3 w-3" />
              {typeof deal.voteCount === 'number' ? deal.voteCount : 0}
            </span>
            <span className="flex items-center gap-1" title={t('comments.title')}>
              <MessageSquare className="h-3 w-3" />
              {liveComments.count}
            </span>
          </div>
        </div>
      </div>

        <div className="flex flex-col items-center justify-between gap-3 pt-3 sm:pt-0 pl-0 sm:pl-4 border-t sm:border-t-0 sm:border-l w-full sm:w-auto sm:min-w-[180px]">
          <VoteControls dealId={deal.id} initialVoteCount={deal.temperature} />

          <div className="grid grid-cols-4 sm:grid-cols-2 gap-2">
            <Button
              variant={isFavorited ? "default" : "outline"}
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite();
              }}
              aria-label={isFavorited ? t('auth.removeFromFavorites') : t('auth.addToFavorites')}
              disabled={isFavoriteLoading}
              className={isFavorited ? "h-11 w-11 p-0 bg-red-500 hover:bg-red-600" : "h-11 w-11 p-0"}
            >
              <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
            </Button>
            <ShareButton
              type="deal"
              itemId={deal.id}
              title={dealTitle || t('labels.deal')}
              url={`/deals/${deal.id}`}
              variant="outline"
              size="icon"
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
          </div>

          <div className="w-full grid grid-cols-1 gap-2">
            {dealUrl ? (
              <Button asChild size="lg" className="w-full whitespace-nowrap bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
                <Link href={dealUrl} target="_blank" rel="noopener noreferrer">
                  {t('actions.goTo')}
                </Link>
              </Button>
            ) : (
              <Button size="lg" className="w-full whitespace-nowrap bg-primary hover:bg-primary/90 text-primary-foreground opacity-80 rounded-xl" disabled>
                {t('actions.goTo')}
              </Button>
            )}
            {productPageUrl && (
              <Button asChild size="sm" variant="outline" className="w-full gap-1">
                <Link href={productPageUrl} onClick={(e) => e.stopPropagation()}>
                  <Package className="h-4 w-4" />
                  {t('labels.viewProduct')}
                </Link>
              </Button>
            )}
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full gap-1"
            onClick={() => {
              try { 
                addDeal(deal, 1);
                toast.success(t('messages.dealAddedToCart'));
              } catch {
                toast.error(t('cart.addToCartError'));
              }
            }}
          >
            <ShoppingCart className="h-4 w-4" />
            {t('cart.addToCart')}
          </Button>
        </div>
    </div>
  );
}
