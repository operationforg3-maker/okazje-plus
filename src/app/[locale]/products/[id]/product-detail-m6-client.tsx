'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { ProductCore, DealM6, ProductRating, Product } from '@/lib/types';
import { getUserProductRating, getProductRatings } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { useFavorites } from '@/hooks/use-favorites';
import { useSmartCart } from '@/lib/cart-context';
import { useCurrency } from '@/lib/unified-currency';
import { getExternalUrl } from '@/lib/external-url';

// Shared Detail Components
import { DetailGallery } from '@/components/detail/detail-gallery';
import { DetailHeader } from '@/components/detail/detail-header';
import { DetailPriceCard } from '@/components/detail/detail-price-card';
import { DetailSpecTeaser } from '@/components/detail/detail-spec-teaser';
import { DetailTabs } from '@/components/detail/detail-tabs';
import { InfiniteSimilarFeed } from '@/components/new-ux/infinite-similar-feed';
import { useComparison } from '@/components/deal-comparison-tool';

interface Props {
  productCore?: ProductCore;
  product?: Product;
  deals: DealM6[];
  relatedProducts: any[];
  recentRatings: ProductRating[];
  isM6: boolean;
}

export default function ProductDetailM6Client({ 
  productCore, 
  product, 
  deals, 
  relatedProducts, 
  recentRatings: initialRatings,
  isM6 
}: Props) {
  const t = useTranslations('products');
  const tCommon = useTranslations('common');
  const { user } = useAuth();
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const [userRating, setUserRating] = useState<ProductRating | null>(null);
  const [recentRatings, setRecentRatings] = useState<ProductRating[]>(initialRatings);
  const { addDeal, isInCart } = useSmartCart();
  const { formatPrice } = useCurrency();
  const { addToComparison } = useComparison();

  const productData = isM6 ? productCore : product;
  const productId = productData?.id || '';

  const mainCategorySlug = isM6 ? productCore?.mainCategorySlug : product?.mainCategorySlug;
  const subCategorySlug = isM6 ? productCore?.subCategorySlug : product?.subCategorySlug;
  const subSubCategorySlug = isM6 ? productCore?.subSubCategorySlug : product?.subSubCategorySlug;

  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(productId, 'product');

  const fetchRatings = useCallback(async () => {
    if (user && productId) {
      const rating = await getUserProductRating(productId, user.uid);
      setUserRating(rating);
    }
    if (productId) {
      const ratings = await getProductRatings(productId, 5);
      setRecentRatings(ratings);
    }
  }, [productId, user]);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  if (!productData) {
    return <div className="page-container py-12 text-center text-muted-foreground">Ładowanie produktu...</div>;
  }

  const getLocalizedText = (field: any, fallback: string = ''): string => {
    if (!field) return fallback;
    if (typeof field === 'string') return field;
    if (typeof field === 'object') {
      return field[locale] || field.pl || field.en || field.de || fallback;
    }
    return fallback;
  };

  const title = getLocalizedText((productData as any)?.title || (product as any)?.name, 'Produkt');
  const fullHtmlDescription = isM6 ? getLocalizedText(productCore?.fullDescription, '') : '';
  const description = isM6 
    ? (fullHtmlDescription || getLocalizedText(productCore?.description, ''))
    : (product?.description || '');
  const hasHtmlDescription = Boolean(description && description.includes('<'));

  const imageUrls = isM6 
    ? Array.from(new Set([
        ...(productCore?.images && Array.isArray(productCore.images) ? productCore.images : []),
        ...((productCore?.gallery || [])
          .filter((item) => item?.type === 'IMAGE' && item?.url)
          .map((item) => item.url)),
      ].filter(Boolean)))
    : (product?.gallery && product?.gallery.length > 0 
        ? product?.gallery.map((g: any) => g.src || g.url) 
        : [product?.image || '']);

  const galleryImages = (imageUrls.length > 0 ? imageUrls : ['/placeholder.png']).map((url, idx) => ({
    id: idx.toString(),
    src: url,
    alt: title,
  }));

  const bestDealTotal = isM6 && Array.isArray(deals) && deals.length > 0
    ? deals.reduce((bestTotal, current) => {
        const shipping = 'shipping' in current ? (current.shipping?.cost || 0) : ((current as any).shippingCost || 0);
        const total = (current.price?.amount || 0) + shipping;
        return total < bestTotal ? total : bestTotal;
      }, Number.POSITIVE_INFINITY)
    : null;

  const priceAmount = isM6
    ? (bestDealTotal !== Number.POSITIVE_INFINITY ? bestDealTotal : (productCore?.bestPrice?.amount || 0))
    : (product?.price || 0);

  const formattedPrice = priceAmount ? formatPrice(priceAmount) : 'N/A';

  const marketPriceInfo = (() => {
    if (!isM6 || !productCore?.averageMarketPrice || !priceAmount) return null;
    const mp = productCore.averageMarketPrice;
    if (!mp.amount || mp.amount <= priceAmount) return null;
    const diff = mp.amount - priceAmount;
    const percent = Math.round((diff / mp.amount) * 100);
    return {
      formatted: formatPrice(mp.amount),
      savingsFormatted: formatPrice(diff),
      percent,
    };
  })();

  const avgRating = isM6 ? (productCore?.rating?.score || 0) : (product?.ratingCard?.average || 0);

  const specsObject = isM6
    ? (
        productCore?.specsLocalized?.[locale]
        || productCore?.specsLocalized?.pl
        || productCore?.specs
        || {}
      )
    : (product?.metadata?.specifications?.reduce((acc: Record<string, string>, spec: any) => {
        const key = spec.key || spec.name || 'Unknown';
        acc[key] = spec.value;
        return acc;
      }, {}) || {});

  const specificationsList = Object.entries(specsObject).map(([key, value]) => ({
    name: key,
    value: String(value),
  }));

  const bestDeal = (() => {
    if (!isM6 || !Array.isArray(deals) || deals.length === 0) return null;
    try {
      return deals.reduce((best, current) => {
        const bestShipping = 'shipping' in best ? best.shipping?.cost || 0 : (best as any).shippingCost || 0;
        const currentShipping = 'shipping' in current ? current.shipping?.cost || 0 : (current as any).shippingCost || 0;
        const bestTotal = (best.price?.amount || 0) + bestShipping;
        const currentTotal = (current.price?.amount || 0) + currentShipping;
        return currentTotal < bestTotal ? current : best;
      }, deals[0]);
    } catch {
      return deals[0];
    }
  })();

  const outboundUrl = bestDeal
    ? getExternalUrl(
        bestDeal.affiliateLink,
        (bestDeal as any).affiliateUrl,
        (bestDeal as any).dealUrl,
        (bestDeal as any).sourceUrl,
        (bestDeal as any).link
      )
    : getExternalUrl(
        (productData as any)?.affiliateUrl,
        (productData as any)?.sourceUrl,
        (productData as any)?.link
      );

  const inCart = bestDeal ? isInCart(bestDeal.id) : false;

  const scrollToDiscussion = () => {
    document.getElementById('detail-tabs-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="page-container pb-12 pt-2 md:pt-4 space-y-8">
      {/* Header (Breadcrumbs, Title, Rating, Merchant Info) */}
      <DetailHeader
        locale={locale}
        itemType="product"
        id={productId}
        title={title}
        mainCategorySlug={mainCategorySlug}
        subCategorySlug={subCategorySlug}
        subSubCategorySlug={subSubCategorySlug}
        merchant={bestDeal?.source || (productData as any)?.merchantName || (productData as any)?.merchant}
        rating={avgRating}
        status={(productData as any)?.status}
        productId={productId}
      />

      {/* 2-Column Main Layout: Sticky Left Gallery (7 cols) | Right Details & Price Card (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sticky Gallery (7 cols on lg) */}
        <div className="lg:col-span-7 self-start">
          <DetailGallery
            images={galleryImages}
            title={title}
            discount={marketPriceInfo?.percent}
            verified={true}
            videoUrl={(productData as any)?.videoUrl}
          />
        </div>

        {/* Right Column: Price Card, Spec Teaser, Tabs (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Price & Action Card */}
          <DetailPriceCard
            id={productId}
            itemType="product"
            title={title}
            formattedPrice={formattedPrice}
            formattedOriginal={marketPriceInfo?.formatted}
            formattedSavings={marketPriceInfo?.savingsFormatted}
            discount={marketPriceInfo?.percent}
            outboundUrl={outboundUrl}
            isFavorited={isFavorited}
            isFavoriteLoading={isFavoriteLoading}
            onToggleFavorite={() => toggleFavorite()}
            onAddToComparison={() => addToComparison({ ...productData, type: 'product' } as any)}
            inCart={inCart}
            onAddToCart={() => bestDeal && addDeal(bestDeal as any, 1)}
            onScrollToComments={scrollToDiscussion}
          />

          {/* Quick Specs Highlight Teaser */}
          {specificationsList.length > 0 && (
            <DetailSpecTeaser specifications={specificationsList} />
          )}

          {/* Tabs Section: Description, Specs Table, Price Comparison, Reviews */}
          <DetailTabs
            id={productId}
            itemType="product"
            description={description}
            hasHtmlDescription={hasHtmlDescription}
            specifications={specificationsList}
            deals={deals}
            productData={productData}
            userRating={userRating}
            recentRatings={recentRatings}
            onRatingSubmitted={fetchRatings}
          />
        </div>
      </div>

      {/* Infinite Scroll Recommendation Stream */}
      <div className="pt-8 border-t border-border/40 space-y-4">
        <div>
          <h2 className="font-headline text-xl sm:text-2xl font-extrabold text-foreground">
            Podobne Produkty i Rekomendacje
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Odkrywaj niekończącą się listę dopasowanych produktów w tej samej kategorii
          </p>
        </div>

        <InfiniteSimilarFeed
          itemType="product"
          categoryId={mainCategorySlug || 'all'}
          excludeId={productId}
        />
      </div>
    </div>
  );
}
