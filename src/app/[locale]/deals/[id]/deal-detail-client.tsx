'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useCurrency, CurrencyManager } from '@/lib/unified-currency';
import { extractPriceInfo, isFreeShipping } from '@/lib/i18n-utils';
import { withImageProxy } from '@/lib/image-proxy';
import Image from 'next/image';
import Link from 'next/link';
import { Deal, Product } from '@/lib/types';
import { getExternalUrl } from '@/lib/external-url';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CategoryBreadcrumb } from '@/components/category-breadcrumb';
import { 
  ChevronRight, 
  ExternalLink, 
  Flame, 
  MessageSquare, 
  Clock,
  User,
  Tag,
  ArrowUp,
  Sparkles,
  TrendingUp,
  Copy,
  Timer,
  AlertCircle,
  Gift,
  Truck,
  Wallet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ShieldCheck,
  Zap,
  Star,
  Package,
  Heart,
  Scale,
  ArrowDown,
} from 'lucide-react';
import DealCard from '@/components/deal-card';
import CommentSection from '@/components/comment-section';
import { useCommentsCount } from '@/hooks/use-comments-count';
import ShareButton from '@/components/share-button';
import { useAuth } from '@/lib/auth';
import { AdminQuickActions } from '@/components/admin/admin-quick-actions';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';
import { SimilarItemsCarousel } from '@/components/similar-items-carousel';
import { InfiniteSimilarFeed } from '@/components/infinite-similar-feed';
import { ExpiredDealBadge } from '@/components/expired-deal-badge';
import { useComparison } from '@/components/deal-comparison-tool';
import { useFavorites } from '@/hooks/use-favorites';
import { useContentLanguage } from '@/hooks/use-content-language';
import { SpecCardGrid } from '@/components/spec-card-grid';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const posted = new Date(isoDate);
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

function getTimeRemaining(expiryDate: string) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  
  if (diffMs <= 0) return null;
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveImageCandidate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = resolveImageCandidate(item);
      if (resolved) return resolved;
    }
    return null;
  }
  if (typeof value === 'object') {
    const candidate =
      (value as any).src ||
      (value as any).url ||
      (value as any).image ||
      (value as any).imageUrl;
    return resolveImageCandidate(candidate);
  }
  return null;
}

interface Props {
  deal: Deal | any;  // M6: Accept both DealLegacy and M6 Deal formats
  product?: Product | null;
  relatedDeals: Deal[];
}

export default function DealDetailClient({ deal, product, relatedDeals }: Props) {
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { getText } = useContentLanguage();
  const productData = product || null;
  const dealTitle = typeof deal.title === 'object' ? getText(deal.title) : deal.title;
  const dealDescriptionRaw = typeof deal.description === 'object' ? getText(deal.description) : deal.description;
  const offerSummaryRaw = typeof deal?.metadata?.offerSummary === 'object'
    ? getText(deal.metadata.offerSummary)
    : (typeof deal?.metadata?.offerSummary === 'string' ? deal.metadata.offerSummary : '');
  const sellingPointsRaw = Array.isArray(deal?.metadata?.sellingPoints)
    ? deal.metadata.sellingPoints
        .map((point: any) => (typeof point === 'object' ? getText(point) : String(point || '')).trim())
        .filter(Boolean)
        .join(' • ')
    : '';
  const fallbackDescription = offerSummaryRaw || sellingPointsRaw;
  const effectiveDescription = dealDescriptionRaw || fallbackDescription || '';
  const hasHtmlDescription = /<[a-z][\s\S]*>/i.test(effectiveDescription);
  const plainDescription = stripHtmlTags(effectiveDescription);
  const linkedProductId =
    (typeof productData?.id === 'string' && productData.id) ||
    (typeof (deal as any)?.productCoreId === 'string' && (deal as any).productCoreId) ||
    (typeof (deal as any)?.product?.id === 'string' && (deal as any).product.id) ||
    (Array.isArray((deal as any)?.linkedProductIds) && typeof (deal as any).linkedProductIds[0] === 'string' ? (deal as any).linkedProductIds[0] : '');
  const { user } = useAuth();
  const liveComments = useCommentsCount('deals', deal.id, deal.commentsCount);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(
    deal.expiryDate ? getTimeRemaining(deal.expiryDate) : null
  );
  const [temperature, setTemperature] = useState(deal.temperature);
  const [voteCount, setVoteCount] = useState(deal.voteCount);
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [priceData, setPriceData] = useState<{
    formattedPrice: string | null;
    formattedOriginal: string | null;
    formattedSavings: string | null;
    formattedMinOrder: string | null;
    discount: number | null;
  }>({
    formattedPrice: null,
    formattedOriginal: null,
    formattedSavings: null,
    formattedMinOrder: null,
    discount: null,
  });
  const { addToComparison } = useComparison();
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(deal.id, 'deal');
  const [activeTab, setActiveTab] = useState<'discussion' | 'specifications'>('discussion');

  const { currency } = useCurrency();
  // Format prices on client using unified currency
  // M6: Support both legacy (deal.price = number) and new (deal.price = {amount, currency}) formats
  useEffect(() => {
    const userCurrency = currency || 'PLN';
    
    // M6 compatibility: Robust extraction
    const { amount: priceAmount, currency: extractedCurrency } = extractPriceInfo(deal.price, deal.legacyPrice);
    const sourceCurrency = (extractedCurrency || 'PLN').toUpperCase() as any;

    const safePrice = Number(priceAmount) || 0;
    
    // Ensure we work with PLN for CurrencyManager
    const priceInPLN = CurrencyManager.convertToPLN(safePrice, sourceCurrency);
    const formatted = CurrencyManager.formatPrice(priceInPLN, userCurrency);
    
    let formattedOrig: string | null = null;
    let calculatedDiscount: number | null = null;
    let savings: string | null = null;
    let minOrder: string | null = null;
    
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
    
    if (typeof deal.minOrderValue === 'number') {
      const minOrderInPLN = CurrencyManager.convertToPLN(deal.minOrderValue, sourceCurrency);
      minOrder = CurrencyManager.formatPrice(minOrderInPLN, userCurrency);
    }
    
    const fallbackDiscount = typeof deal.discountPercent === 'number' ? deal.discountPercent : null;

    setPriceData({
      formattedPrice: formatted,
      formattedOriginal: formattedOrig,
      formattedSavings: savings,
      formattedMinOrder: minOrder,
      discount: calculatedDiscount ?? fallbackDiscount,
    });
  }, [deal.price, deal.originalPrice, deal.minOrderValue, deal.discountPercent, deal.legacyPrice, currency]);

  const outboundUrl = getExternalUrl(
    deal.link,
    (deal as any).affiliateLink,
    (deal as any).affiliateUrl,
    (deal as any).dealUrl,
    (deal as any).sourceUrl,
    (deal as any).url,
    (deal as any).externalUrl,
    deal.metadata?.offerPreviewUrl,
    deal.metadata?.previewUrl,
    (deal as any)?.metadata?.offerUrl,
    (deal as any)?.metadata?.externalUrl,
    (deal as any)?.metadata?.url,
    (deal as any)?.product?.affiliateLink,
    (deal as any)?.product?.sourceUrl,
    (productData as any)?.sourceLinks?.[0]?.url
  );

  // Update countdown every minute
  useEffect(() => {
    if (!deal.expiryDate) return;
    
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(deal.expiryDate!);
      setTimeRemaining(remaining);
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [deal.expiryDate]);

  const isHot = temperature >= 300;
  const isNew = (() => {
    const posted = new Date(deal.postedAt);
    const now = new Date();
    const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  })();

  const temperatureColor = temperature >= 500 ? 'from-red-500 to-orange-500' 
    : temperature >= 300 ? 'from-orange-500 to-amber-500'
    : temperature >= 100 ? 'from-amber-500 to-yellow-500'
    : 'from-yellow-500 to-green-500';

  const temperaturePercent = Math.min((temperature / 500) * 100, 100);

  // Galeria i specyfikacje — oblicz na kliencie tylko aby uniknąć hydration mismatch
  const [images, setImages] = useState<Array<{ id: string; src: string; alt: string }> | null>(null);
  const [specifications, setSpecifications] = useState<any[]>([]);

  useEffect(() => {
    // Bezpieczne obliczenie galerii na kliencie
    let computedImages: Array<{ id: string; src: string; alt: string }> = [];
    
    // dealTitle jest już computed string, użyj go
    const titleString = typeof dealTitle === 'string' ? dealTitle : 'Deal';
    
    if (Array.isArray(deal.gallery) && deal.gallery.length > 0) {
      computedImages = deal.gallery
        .map((item, idx) => {
          const src = resolveImageCandidate(item);
          if (!src) return null;
          return { id: idx.toString(), src, alt: titleString };
        })
        .filter(Boolean) as Array<{ id: string; src: string; alt: string }>;
    } else if (productData && typeof productData === 'object') {
      const productImg =
        resolveImageCandidate((productData as any).image)
        || resolveImageCandidate((productData as any).imageUrl)
        || resolveImageCandidate((productData as any).images)
        || resolveImageCandidate((productData as any)?.metadata?.images)
        || resolveImageCandidate((productData as any)?.metadata?.mainImage);
      if (productImg) {
        computedImages = [{ id: '0', src: productImg, alt: titleString }];
      }
    }
    
    if (computedImages.length === 0) {
      const fallbackImage =
        resolveImageCandidate(deal.image)
        || resolveImageCandidate((deal as any).imageUrl)
        || resolveImageCandidate((deal as any).mainImage)
        || resolveImageCandidate((deal as any).product_main_image_url)
        || resolveImageCandidate((deal as any).images)
        || resolveImageCandidate((deal as any).metadata?.image)
        || resolveImageCandidate((deal as any).metadata?.imageUrl)
        || resolveImageCandidate((deal as any).metadata?.mainImage)
        || '/icon_okazjeplus.svg';

      computedImages = [{ id: '0', src: fallbackImage, alt: titleString }];
    }
    
    setImages(computedImages);

    // Specyfikacje
    const rawSpecs = (deal.metadata as any)?.specifications 
      || (productData as any)?.metadata?.specifications
      || (productData as any)?.specsLocalized?.[locale]
      || (productData as any)?.specsLocalized?.pl
      || (productData as any)?.specs
      || (deal.metadata as any)?.specs;

    let computedSpecs: any[] = [];
    if (rawSpecs) {
      if (Array.isArray(rawSpecs)) {
        computedSpecs = rawSpecs;
      } else if (typeof rawSpecs === 'object') {
        computedSpecs = Object.entries(rawSpecs).map(([key, value]) => ({
          name: key,
          value: String(value)
        }));
      }
    }
    setSpecifications(computedSpecs);
  }, [deal, productData, dealTitle]);

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Deal type badge info
  const dealTypeInfo: Record<string, { label: string; icon: any; color: string }> = {
    sale: { label: 'Wyprzedaż', icon: Tag, color: 'bg-blue-600' },
    coupon: { label: 'Kod rabatowy', icon: Tag, color: 'bg-purple-600' },
    freebie: { label: 'Gratis', icon: Gift, color: 'bg-green-600' },
    'pricing-error': { label: 'Błąd cenowy', icon: AlertCircle, color: 'bg-red-600' },
    cashback: { label: 'Cashback', icon: Wallet, color: 'bg-indigo-600' },
    bundle: { label: 'Zestaw', icon: Package, color: 'bg-orange-600' },
  };

  const currentDealType = deal.dealType && dealTypeInfo[deal.dealType];
  const promotionCampaign = deal.metadata?.promotionCampaign;
  const promotionAppPrice = typeof promotionCampaign?.price?.appSale === 'number'
    ? promotionCampaign.price.appSale
    : undefined;
  const promotionCurrentPrice = typeof promotionCampaign?.price?.current === 'number'
    ? promotionCampaign.price.current
    : undefined;

  const handleCopyCoupon = () => {
    if (deal.couponCode) {
      navigator.clipboard.writeText(deal.couponCode);
      toast.success('Kod skopiowany do schowka!');
    }
  };

  const handleVote = async (action: 'up' | 'down') => {
    if (!user) {
      toast.error('Musisz być zalogowany, aby głosować.');
      return;
    }

    const oldTemperature = temperature;
    const oldVoteCount = voteCount;
    const oldUserVote = userVote;

    let tempDelta = 0;
    let voteDelta = 0;
    const newVoteValue = action === 'up' ? 1 : -1;

    if (userVote === null) {
      tempDelta = newVoteValue;
      voteDelta = newVoteValue;
    } else if (userVote === newVoteValue) {
      return;
    } else {
      tempDelta = newVoteValue - userVote;
      voteDelta = newVoteValue - userVote;
    }

    setTemperature((prev) => prev + tempDelta);
    setVoteCount((prev) => prev + voteDelta);
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
      if (!data?.success) {
        throw new Error(data?.message || 'Błąd głosowania');
      }

      setTemperature(data.temperature);
      setVoteCount(data.voteCount);
      setUserVote(data.userVote);
      toast.success('Dzięki za głos!');
    } catch (error: any) {
      setTemperature(oldTemperature);
      setVoteCount(oldVoteCount);
      setUserVote(oldUserVote);
      toast.error(error?.message || 'Nie udało się zapisać głosu.');
    } finally {
      setIsVoting(false);
    }
  };

  const scrollToDiscussion = () => {
    setActiveTab('discussion');
    setTimeout(() => {
      document.getElementById('deal-discussion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const uniqueQueue = useMemo(() => {
    const uniqueList: any[] = [];
    const seen = new Set<string>();
    const candidates = [
      {
        mainCategorySlug: deal.mainCategorySlug,
        subCategorySlug: deal.subCategorySlug,
        subSubCategorySlug: deal.subSubCategorySlug,
      },
      {
        mainCategorySlug: deal.mainCategorySlug,
        subCategorySlug: deal.subCategorySlug,
      },
      {
        mainCategorySlug: deal.mainCategorySlug,
      },
      {},
    ];
    for (const cand of candidates) {
      const key = `${cand.mainCategorySlug || ''}:${cand.subCategorySlug || ''}:${cand.subSubCategorySlug || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueList.push(cand);
      }
    }
    return uniqueList;
  }, [deal.mainCategorySlug, deal.subCategorySlug, deal.subSubCategorySlug]);

  return (
    <div className="page-container pb-8 pt-2 md:pt-4">
      {/* Breadcrumbs - Navigation + Categories */}
      <div className="mb-4 md:mb-6 flex items-center space-x-2 text-xs md:text-sm text-muted-foreground overflow-x-auto">
        <Link href={`/${locale}`} className="hover:text-primary transition-colors whitespace-nowrap">{tCommon('breadcrumb.home')}</Link>
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <Link href={`/${locale}/deals`} className="hover:text-primary transition-colors whitespace-nowrap">{tCommon('breadcrumb.deals')}</Link>
        
        {deal.mainCategorySlug && (
          <>
            <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
            <CategoryBreadcrumb
              mainCategorySlug={deal.mainCategorySlug}
              subCategorySlug={deal.subCategorySlug}
              subSubCategorySlug={deal.subSubCategorySlug}
              contextType="deals"
              className="pl-0"
            />
          </>
        )}
        
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <span className="font-medium text-foreground truncate max-w-[200px]">{dealTitle}</span>
      </div>

      {/* Main Grid: Left side details, Right side sticky combined actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
        {/* LEFT COLUMN: Gallery, Description, Specs, Discussion */}
        <div className="lg:col-span-8 space-y-6">
          {/* Gallery Card */}
          <div className="relative aspect-[4/3] bg-card rounded-2xl shadow-lg overflow-hidden border">
            {images && images.length > 0 ? (
              <Image
                src={withImageProxy(images[currentImageIndex].src)}
                alt={dealTitle}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
                className="object-contain p-4 md:p-8"
                priority
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            
            {/* Gallery navigation */}
            {images && images.length > 1 && (
              <>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
                  onClick={prevImage}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-lg"
                  onClick={nextImage}
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </Button>
                
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold">
                  {currentImageIndex + 1} / {images.length}
                </div>
              </>
            )}

            {/* Badges on Gallery */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              {isHot && (
                <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md font-bold">
                  <Flame className="mr-1 h-3.5 w-3.5" />
                  Hot
                </Badge>
              )}
              {isNew && (
                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md font-bold">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Nowość
                </Badge>
              )}
              {priceData.discount && priceData.discount > 0 && (
                <Badge variant="destructive" className="shadow-md text-base font-extrabold px-2 py-0.5 rounded-md">
                  -{priceData.discount}%
                </Badge>
              )}
              {deal.verified && (
                <Badge className="bg-green-600 text-white shadow-md font-semibold">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  Zweryfikowane
                </Badge>
              )}
            </div>

            {/* Stock alert */}
            {deal.stockAlert && (
              <Badge 
                variant="outline" 
                className={`absolute top-4 left-4 ${
                  deal.stockAlert === 'ending-soon' ? 'border-red-600 text-red-600 bg-red-50' :
                  deal.stockAlert === 'limited' ? 'border-orange-600 text-orange-600 bg-orange-50' :
                  'border-yellow-600 text-yellow-600 bg-yellow-50'
                }`}
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                {deal.stockAlert === 'ending-soon' ? 'Kończy się' :
                 deal.stockAlert === 'limited' ? 'Limitowana' :
                 'Niski stan'}
              </Badge>
            )}
          </div>

          {/* Gallery Thumbnails */}
          {images && images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-xl border-2 overflow-hidden transition-all ${
                    idx === currentImageIndex ? 'border-primary shadow-sm' : 'border-border/60 hover:border-primary/50'
                  }`}
                >
                  <Image
                    src={withImageProxy(img.src)}
                    alt={dealTitle}
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Description & Main Info */}
          <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="flex items-center gap-1 text-[11px] font-semibold">
                <Tag className="h-3 w-3" />
                {deal.subSubCategorySlug || deal.subCategorySlug || deal.mainCategorySlug}
              </Badge>
              {currentDealType && (
                <Badge className={`${currentDealType.color} text-white text-[11px] font-semibold`}>
                  <currentDealType.icon className="h-3 w-3 mr-1" />
                  {currentDealType.label}
                </Badge>
              )}
            </div>

            <div className="flex items-start justify-between gap-4">
              <h1 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight text-foreground break-words flex-1">
                {dealTitle}
              </h1>
              <AdminQuickActions 
                 productId={deal.product?.id || (deal as any).productCoreId}
                 itemType="deal"
                 className="mt-1 flex-shrink-0"
              />
            </div>

            {/* Meta tags (author, time, store) */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground pb-4 border-b border-border/20">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>Dodane przez <span className="font-semibold text-foreground">{deal.postedBy}</span></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{getRelativeTime(deal.postedAt)}</span>
              </div>
              {deal.merchant && (
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" />
                <span>Sprzedawca: <span className="font-semibold text-foreground">{deal.merchant}</span></span>
            </div>
              )}
            </div>

            {/* Mobile Price Card (block lg:hidden) */}
            <div className="block lg:hidden bg-card border border-border/60 rounded-2xl p-5 shadow-md space-y-4 my-2">
              <div className="flex justify-between items-baseline gap-2.5 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Cena i Oszczędność</span>
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <div className="text-3xl font-black text-foreground tracking-tight">{priceData.formattedPrice || 'N/A'}</div>
                    {priceData.formattedOriginal && (
                      <div className="text-base text-muted-foreground line-through decoration-muted-foreground/45 mb-0.5">{priceData.formattedOriginal}</div>
                    )}
                    {typeof priceData.discount === 'number' && priceData.discount > 0 && (
                      <Badge className="bg-red-500 text-white font-extrabold text-xs px-2 py-0.5 rounded-md">-{priceData.discount}%</Badge>
                    )}
                  </div>
                </div>
                {priceData.formattedSavings && (
                  <div className="text-right">
                    <span className="text-green-600 dark:text-green-500 text-xs font-bold block">
                      Oszczędzasz {priceData.formattedSavings}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {deal.metadata?.isExpired ? (
                  <ExpiredDealBadge 
                    isExpired={true}
                    reason={deal.metadata?.expiryReason || 'Oferta wygasła'}
                    checkedAt={deal.metadata?.expiryCheckedAt}
                    variant="button"
                    className="flex-1 h-12 text-sm"
                  />
                ) : outboundUrl ? (
                  <Button size="lg" asChild className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold h-12 text-sm shadow-md transition-all duration-300">
                    <a href={outboundUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4.5 w-4.5" />
                      Przejdź do okazji
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" className="flex-1 h-12 text-sm" disabled>
                    <ExternalLink className="mr-2 h-4.5 w-4.5" />
                    Brak linku
                  </Button>
                )}
                <ShareButton 
                  type="deal"
                  itemId={deal.id}
                  title={dealTitle}
                  url={`/deals/${deal.id}`}
                  size="lg"
                  variant="outline"
                />
              </div>

              {/* Vote controls (Hot/Cold) & Favorite */}
              <div className="flex items-center justify-between border-t border-border/20 pt-3 gap-2">
                <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/40">
                  <Button
                    variant={userVote === 1 ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleVote('up')}
                    disabled={isVoting}
                    className="h-8 px-2 text-xs font-bold gap-1 rounded-md"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    Hot
                  </Button>
                  <span className="font-bold text-sm px-2 text-foreground min-w-[28px] text-center">{temperature}°</span>
                  <Button
                    variant={userVote === -1 ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleVote('down')}
                    disabled={isVoting}
                    className="h-8 px-2 text-xs font-bold gap-1 rounded-md"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                    Cold
                  </Button>
                </div>

                <Button
                  variant={isFavorited ? 'secondary' : 'outline'}
                  size="icon"
                  onClick={() => toggleFavorite()}
                  disabled={isFavoriteLoading}
                  className="h-8 w-8 border border-border/80"
                  aria-label="Ulubione"
                >
                  <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Description Text */}
            <div className="pt-2">
              {effectiveDescription && hasHtmlDescription ? (
                <div 
                  className="text-sm md:text-base text-muted-foreground leading-relaxed prose prose-neutral dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: effectiveDescription }}
                />
              ) : (
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed whitespace-pre-line">
                  {plainDescription}
                </p>
              )}
            </div>

            {/* Tags badges */}
            {deal.tags && deal.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border/20">
                {deal.tags.map((tag, idx) => (
                  <Badge key={`tag-${tag}-${idx}`} variant="outline" className="text-xs bg-muted/20 text-muted-foreground">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Full Specifications list */}
          {specifications && specifications.length > 0 && (
            <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
              <h3 className="font-headline text-lg font-bold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Pełna specyfikacja
              </h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {specifications.map((spec: any, idx: number) => (
                  <div key={`spec-${idx}-${spec.name || spec.key}`} className="border-b border-border/20 pb-2">
                    <dt className="text-xs font-semibold text-muted-foreground">{spec.name || spec.key}</dt>
                    <dd className="mt-1 text-sm font-bold text-foreground">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Discussion / Comments */}
          <div id="deal-discussion" className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
            <h3 className="font-headline text-lg font-bold mb-6 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Dyskusja ({liveComments.count})
            </h3>
            <CommentSection collectionName="deals" docId={deal.id} />
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky combined box */}
        <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24 space-y-4">
          <Card className="border border-border/60 shadow-xl overflow-hidden rounded-2xl bg-card">
            {/* Header: Price & CTA Section */}
            <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background p-6 border-b border-border/40 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Cena i Oszczędność</span>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <div className="text-3xl md:text-4xl font-black text-foreground tracking-tight">{priceData.formattedPrice || 'N/A'}</div>
                  {priceData.formattedOriginal && (
                    <div className="text-base text-muted-foreground line-through decoration-muted-foreground/45 mb-0.5">{priceData.formattedOriginal}</div>
                  )}
                  {typeof priceData.discount === 'number' && priceData.discount > 0 && (
                    <Badge className="bg-red-500 text-white font-extrabold text-xs px-2 py-0.5 rounded-md">-{priceData.discount}%</Badge>
                  )}
                </div>
                {priceData.formattedSavings && (
                  <p className="text-green-600 dark:text-green-500 text-xs font-bold mt-1">
                    Oszczędzasz {priceData.formattedSavings}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {deal.metadata?.isExpired ? (
                  <ExpiredDealBadge 
                    isExpired={true}
                    reason={deal.metadata?.expiryReason || 'Oferta wygasła'}
                    checkedAt={deal.metadata?.expiryCheckedAt}
                    variant="button"
                    className="flex-1 h-12 text-sm"
                  />
                ) : outboundUrl ? (
                  <Button size="lg" asChild className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold h-12 text-sm shadow-md hover:shadow-lg transition-all duration-300">
                    <a href={outboundUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4.5 w-4.5" />
                      Przejdź do okazji
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" className="flex-1 h-12 text-sm" disabled>
                    <ExternalLink className="mr-2 h-4.5 w-4.5" />
                    Brak linku
                  </Button>
                )}
                <ShareButton 
                  type="deal"
                  itemId={deal.id}
                  title={dealTitle}
                  url={`/deals/${deal.id}`}
                  size="lg"
                  variant="outline"
                />
              </div>

              {/* Vote controls (Hot/Cold) */}
              <div className="flex items-center justify-between border-t border-border/20 pt-3 gap-2">
                <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/40">
                  <Button
                    variant={userVote === 1 ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleVote('up')}
                    disabled={isVoting}
                    className="h-8 px-2 text-xs font-bold gap-1 rounded-md"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    Hot
                  </Button>
                  <span className="font-bold text-sm px-2 text-foreground min-w-[28px] text-center">{temperature}°</span>
                  <Button
                    variant={userVote === -1 ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleVote('down')}
                    disabled={isVoting}
                    className="h-8 px-2 text-xs font-bold gap-1 rounded-md"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                    Cold
                  </Button>
                </div>

                <div className="flex gap-1.5">
                  <Button
                    variant={isFavorited ? 'secondary' : 'outline'}
                    size="icon"
                    onClick={() => toggleFavorite()}
                    disabled={isFavoriteLoading}
                    className="h-10 w-10 border-border/80"
                    aria-label="Ulubione"
                  >
                    <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => addToComparison({ ...deal, type: 'deal' })}
                    className="h-10 w-10 border-border/80"
                    aria-label="Porównaj"
                  >
                    <Scale className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Inner Details: Expiry, Coupon, Shipping, Specs Teaser */}
            <div className="p-6 space-y-4 text-sm">
              {/* Expiry countdown */}
              {deal.expiryDate && timeRemaining && (
                <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-950">
                  <Timer className="h-5 w-5 text-orange-600 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase font-bold text-orange-700 leading-none mb-1">Okazja wygasa za</p>
                    <p className="font-bold text-sm leading-none">{timeRemaining}</p>
                  </div>
                </div>
              )}

              {/* Coupon Code */}
              {deal.couponCode && (
                <div className="p-3.5 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-purple-700 uppercase leading-none mb-1">Kod rabatowy</p>
                    <p className="text-lg font-bold font-mono text-purple-800 leading-none">{deal.couponCode}</p>
                  </div>
                  <Button onClick={handleCopyCoupon} variant="secondary" size="sm" className="h-8">
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Kopiuj
                  </Button>
                </div>
              )}

              {/* Campaign Aliexpress info */}
              {promotionCampaign && (
                <div className="p-3 bg-gradient-to-br from-fuchsia-50/50 to-rose-50/50 border border-fuchsia-100 rounded-xl space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className="bg-fuchsia-600 text-white text-[10px]">
                      {promotionCampaign.label || promotionCampaign.name || 'AliExpress Campaign'}
                    </Badge>
                    {promotionCampaign.flashDeal && (
                      <Badge className="bg-orange-600 text-white text-[10px]">Flash Sale</Badge>
                    )}
                  </div>
                  {(promotionAppPrice !== undefined || promotionCurrentPrice !== undefined) && (
                    <div className="flex gap-4 text-xs">
                      {promotionCurrentPrice !== undefined && (
                        <div>
                          <p className="text-muted-foreground">W kampanii</p>
                          <p className="font-bold text-foreground">{CurrencyManager.formatPrice(promotionCurrentPrice, currency || 'PLN')}</p>
                        </div>
                      )}
                      {promotionAppPrice !== undefined && (
                        <div>
                          <p className="text-muted-foreground">W aplikacji</p>
                          <p className="font-bold text-fuchsia-700">{CurrencyManager.formatPrice(promotionAppPrice, currency || 'PLN')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Shipping & Cashback Logistics */}
              <div className="space-y-2.5 pt-1">
                {deal.freeShipping && (
                  <div className="flex items-center gap-2.5 text-green-700 font-bold text-xs">
                    <Truck className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>Darmowa dostawa</span>
                  </div>
                )}
                {deal.cashback && (
                  <div className="flex items-center gap-2.5 text-indigo-700 font-bold text-xs">
                    <Wallet className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                    <span>Cashback {deal.cashback.percentage ? `${deal.cashback.percentage}%` : `${deal.cashback.amount} PLN`}</span>
                  </div>
                )}
                {deal.minOrderValue && priceData.formattedMinOrder && (
                  <div className="flex items-center gap-2.5 text-muted-foreground text-xs">
                    <Info className="h-4 w-4 text-muted-foreground/80 flex-shrink-0" />
                    <span>Min. zamówienie: <span className="font-semibold text-foreground">{priceData.formattedMinOrder}</span></span>
                  </div>
                )}
                {deal.limitPerUser && (
                  <div className="flex items-center gap-2.5 text-muted-foreground text-xs">
                    <Info className="h-4 w-4 text-muted-foreground/80 flex-shrink-0" />
                    <span>Limit zakupu: <span className="font-semibold text-foreground">{deal.limitPerUser} na osobę</span></span>
                  </div>
                )}
              </div>

              {/* Brief Specs Teaser */}
              {specifications && specifications.length > 0 && (
                <div className="border-t border-border/40 pt-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Parametry w skrócie</p>
                  <div className="space-y-1.5">
                    {specifications.slice(0, 3).map((spec: any, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{spec.name || spec.key}:</span>
                        <span className="font-semibold text-foreground truncate pl-2 max-w-[140px]">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to product details page if any */}
              {linkedProductId && (
                <Button asChild variant="outline" className="w-full h-10 border-border/80 text-xs font-semibold mt-2">
                  <Link href={`/${locale}/products/${linkedProductId}`}>
                    <Package className="mr-2 h-3.5 w-3.5" />
                    Zobacz stronę produktu
                  </Link>
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* PROGRESSIVE SIMILAR DEALS STREAM */}
      <div className="border-t border-border/40 pt-12 mt-12">
        <h3 className="font-headline text-2xl font-bold mb-6 flex items-center gap-2">
          <Flame className="h-6 w-6 text-orange-500" />
          Więcej podobnych okazji
        </h3>
        <InfiniteSimilarFeed
          itemType="deal"
          categoryQueue={uniqueQueue}
          excludeId={deal.id}
        />
      </div>
    </div>
  );
}
