'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ProductCore, DealM6, ProductRating, Product } from '@/lib/types';
import { getUserProductRating, getProductRatings } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Star, 
  ChevronRight, 
  ExternalLink, 
  Package,
  Sparkles,
  TrendingUp,
  Heart,
  ShoppingCart,
  MessageSquare,
  Scale,
  Play,
} from 'lucide-react';
import { PriceComparisonTable } from '@/components/price-comparison-table';
import { ProductPriceHistoryChart } from '@/components/product-price-history-chart';
import { SpecsTable } from '@/components/specs-table';
import GalleryM6 from '@/components/gallery-m6';
import VariantsM6 from '@/components/variants-m6';
import CommentSection from '@/components/comment-section';
import RatingInput from '@/components/rating-input';
import ShareButton from '@/components/share-button';
import { useFavorites } from '@/hooks/use-favorites';
import { useSmartCart } from '@/lib/cart-context';
import { CategoryBreadcrumb } from '@/components/category-breadcrumb';
import { useCurrency } from '@/lib/unified-currency';
import { AdminQuickActions } from '@/components/admin/admin-quick-actions';
import { getExternalUrl } from '@/lib/external-url';
import { LogisticsBadge } from '@/components/product/LogisticsBadge';
import { SellerInfo } from '@/components/product/SellerInfo';

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
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews' | 'rate'>('description');
  const { addItem, isInCart } = useSmartCart();
  const { formatPrice } = useCurrency();

  // Use productCore if M6, otherwise use product
  const productData = isM6 ? productCore : product;
  const productId = productData?.id || '';

  const mainCategorySlug = isM6 ? productCore?.mainCategorySlug : product?.mainCategorySlug;
  const subCategorySlug = isM6 ? productCore?.subCategorySlug : product?.subCategorySlug;
  const subSubCategorySlug = isM6 ? productCore?.subSubCategorySlug : product?.subSubCategorySlug;
  const hasVideo = Boolean(
    (productData as any)?.videoUrl
    || (productData as any)?.productVideoUrl
    || (productData as any)?.product_video_url
    || (Array.isArray((productData as any)?.gallery)
      && (productData as any).gallery.some((item: any) => item?.type === 'VIDEO' && item?.url))
  );
  
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
    return <div className="page-container py-12 text-center">Loading...</div>;
  }

  // Helper: get text in current locale
  const getLocalizedText = (field: any, fallback: string = ''): string => {
    if (!field) return fallback;
    if (typeof field === 'string') return field;
    if (typeof field === 'object') {
      return field[locale] || field.pl || field.en || field.de || fallback;
    }
    return fallback;
  };

  // Extract data with locale support
  const title = getLocalizedText((productData as any)?.title || (product as any)?.name, 'Produkt');
  // Use HTML fullDescription if available, else plain text description
  const fullHtmlDescription = isM6 ? getLocalizedText(productCore?.fullDescription, '') : '';
  const description = isM6 
    ? (fullHtmlDescription || getLocalizedText(productCore?.description, ''))
    : (product?.description || '');

  // Images - M6 has images array, legacy has single image
  const imageUrls = isM6 
    ? Array.from(new Set([
        ...(productCore?.images && Array.isArray(productCore.images) ? productCore.images : []),
        ...((productCore?.gallery || [])
          .filter((item) => item?.type === 'IMAGE' && item?.url)
          .map((item) => item.url)),
      ].filter(Boolean)))
    : (product?.gallery && product?.gallery.length > 0 
        ? product?.gallery.map(g => g.src) 
        : [product?.image || '']);

  const productVariants = isM6 && Array.isArray(productCore?.variants)
    ? productCore.variants
    : [];

  const bestDealTotal = isM6 && Array.isArray(deals) && deals.length > 0
    ? deals.reduce((bestTotal, current) => {
        const shipping = 'shipping' in current ? (current.shipping?.cost || 0) : ((current as any).shippingCost || 0);
        const total = (current.price?.amount || 0) + shipping;
        return total < bestTotal ? total : bestTotal;
      }, Number.POSITIVE_INFINITY)
    : null;

  // Price - for M6 use only active approved deals (bestDeal derived from deals prop)
  const priceAmount = isM6
    ? bestDealTotal
    : (product?.price || 0);

  // Re-render when currency changes for reactive UI
  const formattedPriceWithCurrency = priceAmount !== null ? formatPrice(priceAmount) : '—';

  // M6+ Market Price Estimation Display
  const marketPriceInfo = (() => {
    if (!isM6 || !productCore?.averageMarketPrice || priceAmount === null) return null;
    const mp = productCore.averageMarketPrice;
    if (!mp.amount || mp.amount <= priceAmount) return null; // Only show if we are cheaper
    
    // Calculate market price (convert if needed, assume stored in PLN usually)
    // For now assuming stored as PLN if currency not set, or respecting currency field
    // TODO: Ideally use convertFromPLN if stored in PLN. 
    // Assuming automation stores in PLN for now as per flow instructions.
    
    // Calculate savings
    const diff = mp.amount - priceAmount;
    const percent = Math.round((diff / mp.amount) * 100);
    
    return {
      formatted: formatPrice(mp.amount),
      percent,
      amount: mp.amount
    };
  })();

  // Rating
  const avgRating = isM6 ? (productCore?.rating?.score || 0) : (product?.ratingCard?.average || 0);
  const ratingCount = isM6 ? (productCore?.rating?.count || 0) : (product?.ratingCard?.count || 0);

  // Specs - M6 has specs, legacy might have metadata.specifications
  const specs = isM6
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

  // Best deal (lowest total price) for "Kup teraz"
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

  const bestDealOutboundUrl = bestDeal
    ? getExternalUrl(
        bestDeal.affiliateLink,
        (bestDeal as any).affiliateUrl,
        (bestDeal as any).dealUrl,
        (bestDeal as any).sourceUrl,
        (bestDeal as any).link
      )
    : null;
  const productOutboundUrl = getExternalUrl(
    (productData as any)?.affiliateUrl,
    (productData as any)?.sourceUrl,
    (productData as any)?.link
  );
  const outboundUrl = bestDealOutboundUrl || productOutboundUrl;
  const logistics = productCore?.logistics || (bestDeal
    ? {
        deliveryDays: Math.max(1, Number(bestDeal.shipping?.timeDays || 0) || 7),
        isFreeShipping: Boolean((bestDeal as any).freeShipping ?? ((bestDeal.shipping?.cost || 0) <= 0)),
        shippingCost: Math.max(0, Number(bestDeal.shipping?.cost || 0)),
      }
    : undefined);
  const shippingOrigin = bestDeal?.shipping?.fromCountry || productCore?.warehouses?.[0] || (productCore?.metadata as any)?.shippingFromCountry;
  const bestDealSellingPoints = (bestDeal as any)?.metadata?.sellingPoints?.[locale]
    || (bestDeal as any)?.metadata?.sellingPoints?.pl
    || [];
  const promotionCampaign = (bestDeal as any)?.metadata?.promotionCampaign;
  const promotionAppPrice = typeof promotionCampaign?.price?.appSale === 'number'
    ? promotionCampaign.price.appSale
    : undefined;

  // Helper: map ProductCore -> minimal Product for SmartCart
  const asLegacyProduct = (): Product => {
    return {
      id: productId,
      name: getLocalizedText(productData.title, 'Produkt'),
      image: imageUrls?.[0] || (product as any)?.image || '',
      price: { amount: priceAmount ?? (productCore?.bestPrice?.amount || 0), currency: 'PLN' } as any,
      affiliateUrl: outboundUrl || '',
    } as unknown as Product;
  };


  return (
    <div className="page-container pb-8 pt-2 md:pt-4">
      {/* Breadcrumbs */}
      <div className="mb-4 md:mb-6 flex items-center space-x-2 text-xs md:text-sm text-muted-foreground overflow-x-auto">
        <Link href={`/${locale}`} className="hover:text-foreground transition-colors whitespace-nowrap">
          {tCommon('breadcrumb.home')}
        </Link>
        <ChevronRight className="w-4 h-4 flex-shrink-0" />
        <Link href={`/${locale}/products`} className="hover:text-foreground transition-colors whitespace-nowrap">
          {tCommon('breadcrumb.products')}
        </Link>
        {mainCategorySlug && (
          <>
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
            <CategoryBreadcrumb
              mainCategorySlug={mainCategorySlug}
              subCategorySlug={subCategorySlug}
              subSubCategorySlug={subSubCategorySlug}
              contextType="products"
            />
          </>
        )}
        <ChevronRight className="w-4 h-4 flex-shrink-0" />
        <span className="text-foreground font-medium truncate max-w-[220px]">
          {title}
        </span>
      </div>

      {/* Hero Section - Gallery + Price Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 mb-8">
        {/* Image Gallery - Using GalleryM6 Component */}
        <GalleryM6 images={imageUrls} title={title} />

        {/* Price Widget & Actions */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
                {title}
              </h1>
              <AdminQuickActions 
                productId={productId} 
                itemType="product"
                className="mt-1"
              />
            </div>
            
            {/* Rating */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-gray-600">
                {avgRating.toFixed(1)} ({ratingCount} {ratingCount === 1 ? 'ocena' : 'ocen'})
              </span>
            </div>

            {hasVideo && (
              <Link
                href={`/${locale}/watch/products/${productId}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Play className="w-4 h-4" />
                Obejrzyj wideo produktu
              </Link>
            )}
          </div>

          {/* Best Price Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                {t('productDetail.priceComparison.bestPriceBadge')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 mb-4">
                {formattedPriceWithCurrency}
              </div>

              {isM6 && !bestDeal && (
                <div className="mb-4 p-3 bg-muted/40 rounded-lg text-sm border border-muted text-muted-foreground">
                  {t('productDetail.priceComparison.empty')}
                </div>
              )}
              
              {marketPriceInfo && (
                <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm border border-muted">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-muted-foreground">{t('productDetail.priceComparison.marketPrice.label')}:</span>
                    <span className="font-medium line-through text-muted-foreground">{marketPriceInfo.formatted}</span>
                  </div>
                  <div className="flex justify-between items-center text-green-700 font-medium">
                    <span>{t('productDetail.priceComparison.marketPrice.savings')}:</span>
                    <span className="flex items-center gap-1">
                      <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">-{marketPriceInfo.percent}%</Badge>
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 opacity-70">
                    {t('productDetail.priceComparison.marketPrice.note')}
                  </p>
                </div>
              )}

              {isM6 && deals.length > 0 && (
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {t('productDetail.m6.dealsAvailable', { count: deals.length })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('productDetail.m6.compareHint')}
                  </p>
                </div>
              )}

              {bestDeal?.couponCode && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Kod rabatowy</p>
                      <p className="text-lg font-semibold text-amber-950">{bestDeal.couponCode}</p>
                    </div>
                    <Badge className="bg-amber-600 text-white hover:bg-amber-600">Kupon aktywny</Badge>
                  </div>
                </div>
              )}

              {promotionCampaign && (
                <div className="mt-4 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-fuchsia-600 text-white hover:bg-fuchsia-600">
                      {promotionCampaign.label || promotionCampaign.name || 'Kampania AliExpress'}
                    </Badge>
                    {promotionCampaign.flashDeal && (
                      <Badge className="bg-orange-600 text-white hover:bg-orange-600">Flash Sale</Badge>
                    )}
                    {promotionCampaign.appOnly && (
                      <Badge variant="outline">Cena tylko w aplikacji</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {promotionCampaign.startAt && <span>Start: {new Date(promotionCampaign.startAt).toLocaleString('pl-PL')}</span>}
                    {promotionCampaign.endAt && <span>Koniec: {new Date(promotionCampaign.endAt).toLocaleString('pl-PL')}</span>}
                    {promotionAppPrice !== undefined && <span>Cena w aplikacji: {formatPrice(promotionAppPrice)}</span>}
                  </div>
                </div>
              )}

              {isM6 && (shippingOrigin || bestDeal?.minOrderValue || bestDeal?.limitPerUser || (bestDeal as any)?.freeShipping !== undefined) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {Boolean((bestDeal as any)?.freeShipping ?? ((bestDeal?.shipping?.cost || 0) <= 0)) ? (
                    <Badge className="bg-green-600 text-white hover:bg-green-600">Darmowa dostawa</Badge>
                  ) : (
                    <Badge variant="outline">Wysyłka: {formatPrice(bestDeal?.shipping?.cost || 0)}</Badge>
                  )}
                  {shippingOrigin && <Badge variant="outline">Wysyłka z: {shippingOrigin}</Badge>}
                  {bestDeal?.minOrderValue && <Badge variant="outline">Min. zamówienie: {formatPrice(bestDeal.minOrderValue)}</Badge>}
                  {bestDeal?.limitPerUser && <Badge variant="outline">Limit: {bestDeal.limitPerUser} na osobę</Badge>}
                </div>
              )}
            </CardContent>
          </Card>

          {isM6 && productVariants.length > 0 && (
            <VariantsM6 specs={specs} variants={productVariants} />
          )}

          {isM6 && logistics && <LogisticsBadge logistics={logistics} compact={false} />}

          {isM6 && productCore?.seller && <SellerInfo seller={productCore.seller as any} compact={false} />}

          {isM6 && productCore?.warehouses && productCore.warehouses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Magazyny i wysyłka</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {productCore.warehouses.map((warehouse) => (
                    <Badge key={warehouse} variant={warehouse === 'PL' ? 'default' : 'outline'}>
                      {warehouse === 'PL' ? 'Magazyn PL' : warehouse}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {isM6 && bestDealSellingPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Najważniejsze zalety oferty
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-700">
                  {bestDealSellingPoints.slice(0, 6).map((point: string, index: number) => (
                    <li key={`${point}-${index}`} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {/* Kup teraz */}
            {outboundUrl && (
              <Button asChild size="lg" className="flex-1">
                <a href={outboundUrl} target="_blank" rel="noopener noreferrer">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {t('productDetail.simple.buyNow')}
                </a>
              </Button>
            )}
            {/* Do koszyka */}
            <Button
              size="lg"
              variant="secondary"
              className="flex-1"
              onClick={() => addItem(asLegacyProduct(), 1)}
              disabled={isInCart(productId)}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              {isInCart(productId) ? t('card.inCart') : t('card.toCart')}
            </Button>
            <Button
              onClick={() => toggleFavorite()}
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={isFavoriteLoading}
            >
              <Heart className={`w-5 h-5 mr-2 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
              {isFavorited ? t('card.favoriteRemove') : t('card.favoriteAdd')}
            </Button>
            <ShareButton
              type="product"
              itemId={productData.id}
              url="" // Empty string jako default - ShareButton sam pobierze window.location.href po mount na client
              title={title}
            />
            {/* Porównaj (scroll do tabeli) */}
            {isM6 && deals.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  const el = document.getElementById('price-comparison');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Scale className="w-5 h-5 mr-2" />
                {t('card.compare')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Product Video (if available) */}
      {isM6 && productCore?.videoUrl && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('productDetail.m6.videoTitle')}</CardTitle>
            <CardDescription>{t('productDetail.m6.videoDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
              <video controls className="w-full h-full" src={productCore?.videoUrl} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features / Pros & Cons (if available) */}
      {isM6 && (productCore?.features?.[locale]?.length || productCore?.pros?.[locale]?.length || productCore?.cons?.[locale]?.length) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {productCore?.features?.[locale] && productCore.features[locale].length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cechy produktu</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {productCore?.features?.[locale]?.map((f: string, idx: number) => (
                    <li key={idx} className="text-sm text-gray-700">{f}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {(productCore?.pros?.[locale]?.length || productCore?.cons?.[locale]?.length) && (
            <Card>
              <CardHeader>
                <CardTitle>Plusy i minusy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {productCore?.pros?.[locale] && productCore.pros[locale].length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-green-700">Plusy</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {productCore?.pros?.[locale]?.map((p: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-700">{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {productCore?.cons?.[locale] && productCore.cons[locale].length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-red-700">Minusy</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {productCore?.cons?.[locale]?.map((c: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-700">{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Price Comparison Table (M6 only) */}
            {isM6 && deals.length > 1 && (
        <div className="mb-8" id="price-comparison">
          <PriceComparisonTable productId={productId} initialDeals={deals} onBuyClick={(deal: any) => {
            // Optional: also add to cart after clicking buy
            try { addItem(asLegacyProduct(), 1); } catch {}
          }} />
        </div>
      )}

      {/* Tabs - Description, Specs, Reviews, All Data */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mb-8">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="description">Opis</TabsTrigger>
          <TabsTrigger value="specs">Specyfikacja</TabsTrigger>
          <TabsTrigger value="reviews">Opinie ({ratingCount})</TabsTrigger>
          <TabsTrigger value="rate">Oceń</TabsTrigger>
          <TabsTrigger value="alldata">Wszystkie dane</TabsTrigger>
        </TabsList>

        <TabsContent value="description" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Opis produktu</CardTitle>
            </CardHeader>
            <CardContent>
              {fullHtmlDescription ? (
                <div 
                  className="prose prose-gray max-w-none"
                  dangerouslySetInnerHTML={{ __html: fullHtmlDescription }} 
                />
              ) : (
                <div className="prose prose-gray max-w-none">
                  {description || 'Brak opisu produktu.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specs" className="mt-6">
          <div className="space-y-6">
            {isM6 && productCore?.attributes && productCore.attributes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Parametry źródłowe</CardTitle>
                  <CardDescription>Dane bezpośrednio z importu produktu</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {productCore.attributes.map((attribute, index) => (
                      <div key={`${attribute.name}-${index}`} className="flex flex-col gap-1 rounded-lg border p-3">
                        <span className="font-medium text-gray-900">{attribute.name}</span>
                        <span className="text-gray-600">{attribute.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <SpecsTable specs={specs} title="Specyfikacja techniczna" />
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Opinie użytkowników</CardTitle>
              <CardDescription>
                {ratingCount} {ratingCount === 1 ? 'ocena' : 'ocen'} • Średnia {avgRating.toFixed(1)}/5.0
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentRatings.length > 0 ? (
                <div className="space-y-4">
                  {recentRatings.map((rating) => (
                    <div key={rating.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{rating.userDisplayName || 'Użytkownik'}</div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < rating.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {rating.review && (
                        <p className="text-sm text-gray-600">{rating.review}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">
                  Brak opinii. Bądź pierwszy i zostaw swoją ocenę!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Oceń ten produkt</CardTitle>
              <CardDescription>
                Podziel się swoją opinią z innymi użytkownikami
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <RatingInput
                  productId={productId}
                  existingRating={userRating}
                  onRatingSubmitted={fetchRatings}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Zaloguj się aby ocenić produkt</p>
                  <Button asChild>
                    <Link href={`/${locale}/login`}>Zaloguj się</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alldata" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Wszystkie dane produktu z bazy</CardTitle>
              <CardDescription>Kompletne informacje techniczne i metadane</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 border-b pb-2">Podstawowe informacje</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><span className="font-medium">ID produktu:</span> <code className="bg-muted px-2 py-1 rounded">{productId}</code></div>
                    <div><span className="font-medium">Status:</span> <Badge>{productData.status || 'unknown'}</Badge></div>
                    {productCore?.identityHash && (
                      <div><span className="font-medium">Identity Hash:</span> <code className="bg-muted px-2 py-1 rounded text-xs">{productCore.identityHash.substring(0, 32)}...</code></div>
                    )}
                    {productCore?.aiQualityScore && (
                      <div><span className="font-medium">Quality Score:</span> <Badge variant={productCore.aiQualityScore >= 80 ? 'default' : 'secondary'}>{productCore.aiQualityScore}/100</Badge></div>
                    )}
                    {productCore?.createdAt && (
                      <div><span className="font-medium">Utworzono:</span> {new Date(productCore.createdAt).toLocaleString('pl-PL')}</div>
                    )}
                    {productCore?.updatedAt && (
                      <div><span className="font-medium">Zaktualizowano:</span> {new Date(productCore.updatedAt).toLocaleString('pl-PL')}</div>
                    )}
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 border-b pb-2">Kategorie</h3>
                  <div className="flex flex-wrap gap-2">
                    {productData.mainCategorySlug && <Badge variant="outline">Main: {productData.mainCategorySlug}</Badge>}
                    {productData.subCategorySlug && <Badge variant="outline">Sub: {productData.subCategorySlug}</Badge>}
                    {productData.subSubCategorySlug && <Badge variant="outline">SubSub: {productData.subSubCategorySlug}</Badge>}
                  </div>
                </div>

                {/* Search Tags */}
                {productCore?.searchTags && productCore.searchTags.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 border-b pb-2">Tagi wyszukiwania ({productCore.searchTags.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {productCore.searchTags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specs - ALL fields */}
                {specs && Object.keys(specs).length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 border-b pb-2">Specyfikacja techniczna ({Object.keys(specs).length} pól)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(specs).map(([key, value]) => (
                        <div key={key} className="flex gap-2 border-b border-muted pb-1">
                          <span className="font-medium min-w-[120px]">{key}:</span>
                          <span className="text-muted-foreground break-words">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rating Details */}
                {productCore?.rating && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 border-b pb-2">Szczegóły oceny</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="p-3 bg-muted rounded">
                        <div className="text-2xl font-bold text-primary">{productCore.rating.score?.toFixed(2) || 0}</div>
                        <div className="text-xs text-muted-foreground">Średnia ocena</div>
                      </div>
                      <div className="p-3 bg-muted rounded">
                        <div className="text-2xl font-bold text-primary">{productCore.rating.count || 0}</div>
                        <div className="text-xs text-muted-foreground">Liczba ocen</div>
                      </div>
                      <div className="p-3 bg-muted rounded">
                        <div className="text-2xl font-bold text-blue-600">{productCore.rating.provider || 'mixed'}</div>
                        <div className="text-xs text-muted-foreground">Źródło ocen</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Source Info (from metadata) */}
                {productCore?.metadata?.source && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 border-b pb-2">Źródło produktu</h3>
                    <div className="p-3 bg-muted rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{productCore.metadata.source}</Badge>
                        {productCore.metadata.originalId && (
                          <span className="text-sm text-muted-foreground">ID: {productCore.metadata.originalId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Images Gallery */}
                {imageUrls && imageUrls.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 border-b pb-2">Galeria zdjęć ({imageUrls.length})</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {imageUrls.map((url: string, idx: number) => (
                        <div key={idx} className="relative aspect-square bg-muted rounded overflow-hidden">
                          <Image src={url} alt={`${title} - zdjęcie ${idx + 1}`} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-contain" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata (import info) */}
                {productCore?.metadata && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 border-b pb-2">Metadane importu</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {productCore.metadata.source && (
                        <div><span className="font-medium">Źródło:</span> <Badge variant="outline">{productCore.metadata.source}</Badge></div>
                      )}
                      {productCore.metadata.importedAt && (
                        <div><span className="font-medium">Data importu:</span> {new Date(productCore.metadata.importedAt).toLocaleString('pl-PL')}</div>
                      )}
                      {productCore.metadata.originalId && (
                        <div><span className="font-medium">ID źródłowe:</span> <code className="bg-muted px-2 py-1 rounded text-xs">{productCore.metadata.originalId}</code></div>
                      )}
                      {productCore.metadata.enrichedAt && (
                        <div><span className="font-medium">Wzbogacono:</span> {new Date(productCore.metadata.enrichedAt).toLocaleString('pl-PL')}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* All Descriptions (multilingual) */}
                {productCore?.description && typeof productCore.description === 'object' && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 border-b pb-2">Opisy w różnych językach</h3>
                    <Tabs defaultValue="pl" className="w-full">
                      <TabsList>
                        {productCore.description.pl && <TabsTrigger value="pl">Polski</TabsTrigger>}
                        {productCore.description.en && <TabsTrigger value="en">English</TabsTrigger>}
                        {productCore.description.de && <TabsTrigger value="de">Deutsch</TabsTrigger>}
                        {productCore.description.fr && <TabsTrigger value="fr">Français</TabsTrigger>}
                        {productCore.description.es && <TabsTrigger value="es">Español</TabsTrigger>}
                        {productCore.description.uk && <TabsTrigger value="uk">Українська</TabsTrigger>}
                      </TabsList>
                      {productCore.description.pl && (
                        <TabsContent value="pl" className="mt-4">
                          <div className="prose prose-sm max-w-none p-4 bg-muted rounded">
                            {productCore.description.pl}
                          </div>
                        </TabsContent>
                      )}
                      {productCore.description.en && (
                        <TabsContent value="en" className="mt-4">
                          <div className="prose prose-sm max-w-none p-4 bg-muted rounded">
                            {productCore.description.en}
                          </div>
                        </TabsContent>
                      )}
                      {productCore.description.de && (
                        <TabsContent value="de" className="mt-4">
                          <div className="prose prose-sm max-w-none p-4 bg-muted rounded">
                            {productCore.description.de}
                          </div>
                        </TabsContent>
                      )}
                      {productCore.description.fr && (
                        <TabsContent value="fr" className="mt-4">
                          <div className="prose prose-sm max-w-none p-4 bg-muted rounded">
                            {productCore.description.fr}
                          </div>
                        </TabsContent>
                      )}
                      {productCore.description.es && (
                        <TabsContent value="es" className="mt-4">
                          <div className="prose prose-sm max-w-none p-4 bg-muted rounded">
                            {productCore.description.es}
                          </div>
                        </TabsContent>
                      )}
                      {productCore.description.uk && (
                        <TabsContent value="uk" className="mt-4">
                          <div className="prose prose-sm max-w-none p-4 bg-muted rounded">
                            {productCore.description.uk}
                          </div>
                        </TabsContent>
                      )}
                    </Tabs>
                  </div>
                )}

                {/* Raw JSON dump dla debugowania */}
                <details className="border rounded p-4">
                  <summary className="font-semibold cursor-pointer">Raw JSON (dla programistów)</summary>
                  <pre className="mt-3 p-3 bg-muted rounded text-xs overflow-x-auto">
                    {JSON.stringify(productData, null, 2)}
                  </pre>
                </details>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Comments Section - tylko jeśli productId istnieje */}
      {productId && (
        <div className="mb-8">
          <CommentSection collectionName="products" docId={productId} />
        </div>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Podobne produkty</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedProducts.filter(p => p.id).map((relatedProduct, index) => (
              <Link
                key={relatedProduct.id || `related-${index}`}
                href={`/${locale}/products/${relatedProduct.id}`}
                className="group"
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="relative aspect-square mb-4 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={relatedProduct.images?.[0] || relatedProduct.image}
                        alt={relatedProduct.title?.pl || relatedProduct.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-contain p-2 group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <h3 className="font-medium line-clamp-2 mb-2">
                      {relatedProduct.title?.pl || relatedProduct.name}
                    </h3>
                    {relatedProduct.bestPrice && (
                      <p className="text-lg font-bold text-green-600">
                        {formatPrice(relatedProduct.bestPrice.amount)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Price History Chart (M6 only) */}
      {isM6 && deals.length > 0 && (
        <div className="mb-8">
          <ProductPriceHistoryChart deals={deals} />
        </div>
      )}
    </div>
  );
}
