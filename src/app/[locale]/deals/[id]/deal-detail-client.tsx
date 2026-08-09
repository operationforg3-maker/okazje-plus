'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useCurrency, CurrencyManager } from '@/lib/unified-currency';
import { extractPriceInfo } from '@/lib/i18n-utils';
import { Deal, Product } from '@/lib/types';
import { getExternalUrl } from '@/lib/external-url';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { toast } from 'sonner';
import { useComparison } from '@/components/deal-comparison-tool';
import { useFavorites } from '@/hooks/use-favorites';
import { useContentLanguage } from '@/hooks/use-content-language';
import { useSmartCart } from '@/lib/cart-context';
import { AuthModal } from '@/components/auth/auth-modal';

// Shared Detail Components
import { DetailGallery } from '@/components/detail/detail-gallery';
import { DetailHeader } from '@/components/detail/detail-header';
import { DetailPriceCard } from '@/components/detail/detail-price-card';
import { DetailSpecTeaser } from '@/components/detail/detail-spec-teaser';
import { DetailTabs } from '@/components/detail/detail-tabs';
import { InfiniteSimilarFeed } from '@/components/new-ux/infinite-similar-feed';

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
  }
  return null;
}

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

interface DealDetailClientProps {
  deal: Deal;
  product?: Product | null;
  productData?: Product | null;
  relatedDeals?: Deal[];
  initialComments?: any[];
}

export default function DealDetailClient({ deal, product, productData: propProductData }: DealDetailClientProps) {
  const productData = propProductData || product;
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const t = useTranslations('deals');
  const { user } = useAuth();
  const { getText } = useContentLanguage();
  const safeText = (val: any) => typeof val === 'string' ? val : (val?.pl || val?.en || '');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalActionType, setAuthModalActionType] = useState<'favorite' | 'vote' | 'comment'>('favorite');

  const liveComments = useCommentsCount(deal.id, 'deals' as any, (deal as any).commentCount ?? 0);
  const userVoteValue = (deal as any).userVote ?? null;
  const discountPercentValue = (deal as any).discountPercent ?? null;
  const offerPreviewUrlValue = (deal.metadata as any)?.offerPreviewUrl;
  const previewUrlValue = (deal.metadata as any)?.previewUrl;
  const linkedProduct = (deal as any).product;

  const [temperature, setTemperature] = useState(deal.temperature ?? 0);
  const [voteCount, setVoteCount] = useState(deal.voteCount ?? 0);
  const [userVote, setUserVote] = useState<number | null>(deal.userVote ?? null);
  const [isVoting, setIsVoting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(
    deal.expiryDate ? getTimeRemaining(deal.expiryDate) : null
  );

  const { addDeal, isInCart } = useSmartCart();
  const inCart = isInCart(deal.id);

  const dealTitleText = getText(deal.title) || safeText(deal.title);
  const dealTitle = dealTitleText || 'Okazja';

  const descriptionText = getText(deal.description) || safeText(deal.description);
  const plainDescription = descriptionText || '';
  const productHtmlDescription = safeText((productData as any)?.fullDescription || (productData as any)?.description);
  const hasHtmlDescription = Boolean(productHtmlDescription && productHtmlDescription.includes('<'));
  const effectiveDescription = hasHtmlDescription ? productHtmlDescription : plainDescription;

  const [priceData, setPriceData] = useState<{
    formattedPrice: string;
    formattedOriginal: string | null;
    formattedSavings: string | null;
    formattedMinOrder: string | null;
    discount: number | null;
  }>({
    formattedPrice: '',
    formattedOriginal: null,
    formattedSavings: null,
    formattedMinOrder: null,
    discount: null,
  });

  const { addToComparison } = useComparison();
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(deal.id, 'deal');

  const { currency } = useCurrency();

  useEffect(() => {
    const userCurrency = currency || 'PLN';
    const { amount: priceAmount, currency: extractedCurrency } = extractPriceInfo(deal.price, deal.legacyPrice);
    const sourceCurrency = (extractedCurrency || 'PLN').toUpperCase() as any;

    const safePrice = Number(priceAmount) || 0;
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

  useEffect(() => {
    if (!deal.expiryDate) return;
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(deal.expiryDate!);
      setTimeRemaining(remaining);
    }, 60000);
    return () => clearInterval(interval);
  }, [deal.expiryDate]);

  const isHot = temperature >= 300;
  const isNew = (() => {
    const posted = new Date(deal.postedAt);
    const now = new Date();
    const diffDays = (now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  })();

  const [images, setImages] = useState<Array<{ id: string; src: string; alt: string }> | null>(null);
  const [specifications, setSpecifications] = useState<any[]>([]);

  useEffect(() => {
    let computedImages: Array<{ id: string; src: string; alt: string }> = [];
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
  }, [deal, productData, dealTitle, locale]);

  const dealTypeInfo: Record<string, { label: string; color: string }> = {
    sale: { label: 'Wyprzedaż', color: 'bg-blue-600' },
    coupon: { label: 'Kod rabatowy', color: 'bg-purple-600' },
    freebie: { label: 'Gratis', color: 'bg-green-600' },
    'pricing-error': { label: 'Błąd cenowy', color: 'bg-red-600' },
    cashback: { label: 'Cashback', color: 'bg-indigo-600' },
    bundle: { label: 'Zestaw', color: 'bg-orange-600' },
  };
  const currentDealType = deal.dealType ? dealTypeInfo[deal.dealType] : null;

  const handleVote = async (action: 'up' | 'down') => {
    if (!user) {
      setAuthModalActionType('vote');
      setAuthModalOpen(true);
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
    document.getElementById('detail-tabs-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="page-container pb-12 pt-2 md:pt-4 space-y-8">
      {/* Header (Breadcrumbs, Title, Meta Info) */}
      <DetailHeader
        locale={locale}
        itemType="deal"
        id={deal.id}
        title={dealTitle}
        mainCategorySlug={deal.mainCategorySlug}
        subCategorySlug={deal.subCategorySlug}
        subSubCategorySlug={deal.subSubCategorySlug}
        postedBy={deal.postedBy}
        relativeTime={getRelativeTime(deal.postedAt)}
        merchant={deal.merchant}
        dealTypeLabel={currentDealType?.label}
        dealTypeColor={currentDealType?.color}
        status={deal.status}
        productId={deal.product?.id || (deal as any).productCoreId}
      />

      {/* 2-Column Main Layout: Sticky Left Gallery (7 cols) | Right Details & Price Card (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sticky Gallery (7 cols on lg) */}
        <div className="lg:col-span-7 self-start">
          <DetailGallery
            images={images || []}
            title={dealTitle}
            isHot={isHot}
            isNew={isNew}
            discount={priceData.discount}
            verified={deal.verified}
            stockAlert={deal.stockAlert}
            videoUrl={(deal as any)?.videoUrl}
          />
        </div>

        {/* Right Column: Price Card, Spec Teaser, Tabs (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Price & Action Card */}
          <DetailPriceCard
            id={deal.id}
            itemType="deal"
            title={dealTitle}
            formattedPrice={priceData.formattedPrice}
            formattedOriginal={priceData.formattedOriginal}
            formattedSavings={priceData.formattedSavings}
            discount={priceData.discount}
            couponCode={deal.couponCode}
            expiryTimeRemaining={timeRemaining}
            isExpired={deal.metadata?.isExpired}
            expiryReason={deal.metadata?.expiryReason}
            outboundUrl={outboundUrl}
            temperature={temperature}
            userVote={userVote}
            isVoting={isVoting}
            onVote={handleVote}
            isFavorited={isFavorited}
            isFavoriteLoading={isFavoriteLoading}
            onToggleFavorite={() => toggleFavorite()}
            onAddToComparison={() => addToComparison({ ...deal, type: 'deal' })}
            inCart={inCart}
            onAddToCart={() => addDeal(deal, 1)}
            commentsCount={liveComments.count}
            onScrollToComments={scrollToDiscussion}
          />

          {/* Quick Specs Highlight Teaser */}
          {specifications && specifications.length > 0 && (
            <DetailSpecTeaser specifications={specifications} />
          )}

          {/* Tabs Section: Description, Specs, Discussions */}
          <DetailTabs
            id={deal.id}
            itemType="deal"
            description={effectiveDescription}
            hasHtmlDescription={hasHtmlDescription}
            specifications={specifications}
            productData={productData}
            commentsCount={liveComments.count}
            conditions={deal.conditions}
            freeShipping={deal.freeShipping}
            cashback={deal.cashback}
            minOrderValue={priceData.formattedMinOrder}
            limitPerUser={deal.limitPerUser}
            requiresMembership={deal.requiresMembership}
          />
        </div>
      </div>

      {/* Infinite Scroll Recommendation Stream */}
      <div className="pt-8 border-t border-border/40 space-y-4">
        <div>
          <h2 className="font-headline text-xl sm:text-2xl font-extrabold text-foreground">
            Podobne Okazje i Rekomendacje
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Odkrywaj niekończącą się listę dopasowanych ofert w tej samej kategorii
          </p>
        </div>

        <InfiniteSimilarFeed
          itemType="deal"
          categoryId={deal.mainCategorySlug || 'all'}
          excludeId={deal.id}
        />
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        actionType={authModalActionType}
      />
    </div>
  );
}
