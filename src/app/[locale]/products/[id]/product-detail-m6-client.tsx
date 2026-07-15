'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useFavorites } from '@/hooks/use-favorites';
import { useSmartCart } from '@/lib/cart-context';
import { Sparkline, generateSmartBadges } from '@/components/product/Sparkline';
import ShareButton from '@/components/share-button';
import { cn } from '@/lib/utils';
import { CategoryBreadcrumb } from '@/components/category-breadcrumb';
import { useCurrency, CurrencyManager } from '@/lib/unified-currency';
import { AdminQuickActions } from '@/components/admin/admin-quick-actions';
import { getExternalUrl } from '@/lib/external-url';
import { LogisticsBadge } from '@/components/product/LogisticsBadge';
import { SellerInfo } from '@/components/product/SellerInfo';
import { InfiniteSimilarFeed } from '@/components/infinite-similar-feed';

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
        ? product?.gallery.map((g: any) => g.src || g.url) 
        : [product?.image || '']);

  const productVariants = isM6 && Array.isArray(productCore?.variants)
    ? productCore.variants
    : [];

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  // Initialize selected variants with the first option from each dimension
  useEffect(() => {
    if (productVariants && productVariants.length > 0) {
      const initial: Record<string, string> = {};
      productVariants.forEach(v => {
        if (v.name && Array.isArray(v.values) && v.values.length > 0) {
          initial[v.name] = v.values[0];
        }
      });
      setSelectedVariants(initial);
    }
  }, [productVariants]);

  const handleVariantChange = (name: string, value: string) => {
    setSelectedVariants(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const matchedSku = useMemo(() => {
    const skus = productCore?.skuList;
    if (!skus || !Array.isArray(skus) || skus.length === 0) return null;
    
    return skus.find(sku => {
      if (!sku.attributes || !Array.isArray(sku.attributes)) return false;
      return sku.attributes.every((attr: any) => {
        const selectedValue = selectedVariants[attr.name];
        return selectedValue === attr.value;
      });
    });
  }, [productCore?.skuList, selectedVariants]);

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

  const activePriceAmount = useMemo(() => {
    if (matchedSku && typeof matchedSku.price === 'number' && matchedSku.price > 0) {
      return matchedSku.price;
    }
    return priceAmount;
  }, [matchedSku, priceAmount]);

  // Re-render when currency changes for reactive UI
  const formattedPriceWithCurrency = activePriceAmount !== null ? formatPrice(activePriceAmount) : '—';

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
  const bestDealShippingCost = bestDeal
    ? (bestDeal.shipping?.cost !== undefined
        ? Number(bestDeal.shipping.cost)
        : ((bestDeal as any).shippingCost !== undefined ? Number((bestDeal as any).shippingCost) : undefined))
    : undefined;

  const logistics = productCore?.logistics || (bestDeal
    ? {
        deliveryDays: Math.max(1, Number(bestDeal.shipping?.timeDays || (bestDeal as any).shippingTimeDays || 0) || 7),
        isFreeShipping: Boolean((bestDeal as any).freeShipping ?? ((bestDealShippingCost ?? 0) <= 0)),
        shippingCost: Math.max(0, Number(bestDealShippingCost ?? 0)),
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

  const deepDataBadges = useMemo(() => {
    return generateSmartBadges({
      price: {
        current: priceAmount ?? 0,
        lowest30d: bestDeal?.lowestPriceIn30Days,
      },
      logistics: productCore?.logistics || (product as any)?.logistics,
      priceHistory: bestDeal?.priceHistory,
    });
  }, [priceAmount, bestDeal, productCore, product]);

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


  const uniqueQueue = useMemo(() => {
    const uniqueList = [];
    const seen = new Set();
    const candidates = [
      {
        mainCategorySlug,
        subCategorySlug,
        subSubCategorySlug,
      },
      {
        mainCategorySlug,
        subCategorySlug,
      },
      {
        mainCategorySlug,
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
  }, [mainCategorySlug, subCategorySlug, subSubCategorySlug]);

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

      {/* Main Grid Layout: Left Column (Gallery + Info), Right Column (Sticky Box) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
        {/* LEFT COLUMN: Gallery, Description, Price Comparison, Specs, Comments */}
        <div className="lg:col-span-8 space-y-6">
          {/* Gallery Component */}
          {(() => {
            const activeImageUrls = [...imageUrls];
            if (matchedSku && matchedSku.image) {
              if (!activeImageUrls.includes(matchedSku.image)) {
                activeImageUrls.unshift(matchedSku.image);
              } else {
                const index = activeImageUrls.indexOf(matchedSku.image);
                if (index > 0) {
                  activeImageUrls.splice(index, 1);
                  activeImageUrls.unshift(matchedSku.image);
                }
              }
            }
            return <GalleryM6 images={activeImageUrls} title={title} />;
          })()}

          {/* Description Card */}
          <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-headline text-2xl md:text-3xl font-extrabold tracking-tight text-foreground break-words flex-1">
                {title}
              </h1>
              <AdminQuickActions 
                productId={productId} 
                itemType="product"
                className="mt-1 flex-shrink-0"
              />
            </div>

            {/* Ratings & Video Link */}
            <div className="flex flex-wrap items-center gap-4 text-sm pb-4 border-b border-border/20">
              <div className="flex items-center gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                    }`}
                  />
                ))}
                <span className="font-bold text-foreground pl-1">{avgRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({ratingCount} ocen)</span>
              </div>

              {hasVideo && (
                <Link
                  href={`/${locale}/watch/products/${productId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline ml-auto"
                >
                  <Play className="w-3.5 h-3.5 fill-primary" />
                  Obejrzyj wideo
                </Link>
              )}
            </div>

            {/* Smart Badges (features currently on cards) */}
            {deepDataBadges && deepDataBadges.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5 border-t border-border/20 pt-3">
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
                      className="text-white text-[10px] px-2 py-0.5 font-bold rounded-md"
                      style={{ backgroundColor: getBadgeColor(badge.color) }}
                    >
                      {badge.text}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Mobile Price Card (block lg:hidden) */}
            <div className="block lg:hidden bg-card border border-border/60 rounded-2xl p-5 shadow-md space-y-4 my-2">
              <div className="flex justify-between items-baseline gap-2.5 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    {bestDeal?.source ? `Najlepsza Cena (${bestDeal.source})` : 'Cena produktu'}
                  </span>
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <div className="text-3xl font-black text-foreground tracking-tight">
                      {formattedPriceWithCurrency}
                    </div>
                    {marketPriceInfo && (
                      <div className="text-sm text-muted-foreground line-through decoration-muted-foreground/45 mb-0.5">
                        {marketPriceInfo.formatted}
                      </div>
                    )}
                    {marketPriceInfo && (
                      <Badge className="bg-red-500 text-white font-extrabold text-xs px-2 py-0.5 rounded-md">
                        -{marketPriceInfo.percent}%
                      </Badge>
                    )}
                  </div>
                </div>
                {marketPriceInfo && (
                  <div className="text-right">
                    <span className="text-green-600 dark:text-green-500 text-xs font-bold block">
                      Oszczędzasz {formatPrice(marketPriceInfo.amount - (priceAmount ?? 0))}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {outboundUrl ? (
                  <Button size="lg" asChild className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold h-12 text-sm shadow-md transition-all duration-300">
                    <a href={outboundUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4.5 w-4.5" />
                      Idź do sklepu
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" className="flex-1 h-12 text-sm" disabled>
                    <ExternalLink className="mr-2 h-4.5 w-4.5" />
                    Brak linku
                  </Button>
                )}
                <ShareButton 
                  type="product"
                  itemId={productId}
                  title={title}
                  url={`/products/${productId}`}
                  size="lg"
                  variant="outline"
                />
              </div>

              {/* Favorites & Cart Action Strip */}
              <div className="flex items-center justify-between border-t border-border/20 pt-3 gap-2">
                <Button
                  variant={isInCart(productId) ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => addItem(asLegacyProduct())}
                  className="h-9 px-3 text-xs font-bold gap-1.5 rounded-lg border-border/80 flex-1"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {isInCart(productId) ? 'W koszyku' : 'Dodaj do koszyka'}
                </Button>

                <Button
                  variant={isFavorited ? 'secondary' : 'outline'}
                  size="icon"
                  onClick={() => toggleFavorite()}
                  disabled={isFavoriteLoading}
                  className="h-9 w-9 border-border/80"
                  aria-label="Ulubione"
                >
                  <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Description Text */}
            <div className="pt-2">
              {description ? (
                <div 
                  className="text-sm md:text-base text-muted-foreground leading-relaxed prose prose-neutral dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: description }}
                />
              ) : (
                <p className="text-sm md:text-base text-muted-foreground italic">
                  Brak opisu dla tego produktu.
                </p>
              )}
            </div>
          </div>

          {/* Variants selector if any */}
          {productVariants && productVariants.length > 0 && (
            <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
              <VariantsM6 
                variants={productVariants} 
                specs={specs} 
                onVariantChange={handleVariantChange} 
              />
            </div>
          )}

          {/* Price Comparison Table */}
          {isM6 && deals.length > 0 && (
            <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm" id="price-comparison">
              <h3 className="font-headline text-lg font-bold mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Porównanie ofert w sklepach
              </h3>
              <PriceComparisonTable productId={productId} initialDeals={deals} onBuyClick={(deal) => {
                const url = getExternalUrl(deal.affiliateLink, deal.link);
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
              }} />
            </div>
          )}

          {/* Specifications Table */}
          {specs && Object.keys(specs).length > 0 && (
            <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
              <h3 className="font-headline text-lg font-bold mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Specyfikacja techniczna
              </h3>
              <SpecsTable specs={specs} />
            </div>
          )}

          {/* Price History Chart */}
          {isM6 && deals.length > 0 && (
            <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
              <h3 className="font-headline text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Historia ceny produktu
              </h3>
              <ProductPriceHistoryChart deals={deals} />
            </div>
          )}

          {/* Discussion / Comments */}
          {productId && (
            <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
              <h3 className="font-headline text-lg font-bold mb-6 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Dyskusja i opinie
              </h3>
              
              <div className="space-y-6">
                <RatingInput productId={productId} onRatingSubmitted={fetchRatings} />
                <CommentSection collectionName="products" docId={productId} />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sticky combined info card */}
        <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24 space-y-4">
          <Card className="border border-border/60 shadow-xl overflow-hidden rounded-2xl bg-card">
            {/* Header: Best Price & Primary Action */}
            <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background p-6 border-b border-border/40 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  {bestDeal?.source ? `Najlepsza Cena (${bestDeal.source})` : 'Cena produktu'}
                </span>
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <div className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                    {formattedPriceWithCurrency}
                  </div>
                  {bestDeal?.priceHistory && Array.isArray(bestDeal.priceHistory) && bestDeal.priceHistory.length > 1 && (
                    <div className="flex items-center gap-1.5 ml-3">
                      <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Trend:</span>
                      <Sparkline data={bestDeal.priceHistory} width={60} height={12} />
                    </div>
                  )}
                  {marketPriceInfo && (
                    <div className="text-base text-muted-foreground line-through decoration-muted-foreground/45 mb-0.5">
                      {marketPriceInfo.formatted}
                    </div>
                  )}
                  {marketPriceInfo && (
                    <Badge className="bg-red-500 text-white font-extrabold text-xs px-2 py-0.5 rounded-md">
                      -{marketPriceInfo.percent}%
                    </Badge>
                  )}
                </div>
                {marketPriceInfo && (
                  <p className="text-green-600 dark:text-green-500 text-xs font-bold mt-1">
                    Oszczędzasz {formatPrice(marketPriceInfo.amount - (priceAmount ?? 0))}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {outboundUrl ? (
                  <Button size="lg" asChild className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold h-12 text-sm shadow-md hover:shadow-lg transition-all duration-300">
                    <a href={outboundUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4.5 w-4.5" />
                      Idź do sklepu
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" className="flex-1 h-12 text-sm" disabled>
                    <ExternalLink className="mr-2 h-4.5 w-4.5" />
                    Brak linku
                  </Button>
                )}
                <ShareButton 
                  type="product"
                  itemId={productId}
                  title={title}
                  url={`/products/${productId}`}
                  size="lg"
                  variant="outline"
                />
              </div>

              {/* Gated Cart & Favorites (Incentive for non-logged in users) */}
              {!user ? (
                <div className="bg-amber-50/50 dark:bg-zinc-900/50 border border-dashed border-amber-200 dark:border-zinc-800 rounded-xl p-3.5 text-center space-y-2 border-t mt-3">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">
                    🔑 Zaloguj się, aby dodawać do koszyka i zapisywać produkty!
                  </p>
                  <Button asChild size="sm" variant="outline" className="w-full text-[11px] h-8 border-amber-300 hover:bg-amber-100 text-amber-800 dark:text-amber-300">
                    <Link href={`/${locale}/login`}>
                      Zaloguj się teraz
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between border-t border-border/20 pt-3 gap-2">
                  <Button
                    variant={isInCart(productId) ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => addItem(asLegacyProduct())}
                    className="h-9 px-3 text-xs font-bold gap-1.5 rounded-lg border-border/80 flex-1"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {isInCart(productId) ? 'W koszyku' : 'Dodaj do koszyka'}
                  </Button>

                  <Button
                    variant={isFavorited ? 'secondary' : 'outline'}
                    size="icon"
                    onClick={() => toggleFavorite()}
                    disabled={isFavoriteLoading}
                    className="h-9 w-9 border-border/80"
                    aria-label="Ulubione"
                  >
                    <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                </div>
              )}
            </div>

            {/* Inner Details: Logistics, Warehouses, Specs Teaser */}
            <div className="p-6 space-y-4 text-sm">
              {/* Delivery / Shipping details */}
              {logistics && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Szczegóły wysyłki</p>
                  
                  <div className="flex items-center gap-2.5 text-xs">
                    <LogisticsBadge logistics={logistics} />
                  </div>
                  
                  {shippingOrigin && (
                    <div className="flex items-center gap-2.5 text-muted-foreground text-xs">
                      <span className="font-semibold text-foreground">Wysyłka z:</span>
                      <span className="uppercase">{shippingOrigin}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Seller details */}
              {bestDeal && (
                <div className="border-t border-border/40 pt-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Sprzedawca</p>
                  <SellerInfo seller={bestDeal.seller || { name: bestDeal.source }} />
                </div>
              )}

              {/* Selling points list */}
              {bestDealSellingPoints && bestDealSellingPoints.length > 0 && (
                <div className="border-t border-border/40 pt-3">
                  <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
                    {bestDealSellingPoints.map((point, idx) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Specs Teaser */}
              {specs && Object.keys(specs).length > 0 && (
                <div className="border-t border-border/40 pt-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Główne cechy</p>
                  <div className="space-y-1.5">
                    {Object.entries(specs).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate max-w-[120px]">{key}:</span>
                        <span className="font-semibold text-foreground truncate pl-2 max-w-[140px]">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* PROGRESSIVE SIMILAR PRODUCTS STREAM */}
      <div className="border-t border-border/40 pt-12 mt-12">
        <h3 className="font-headline text-2xl font-bold mb-6 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Podobne produkty
        </h3>
        <InfiniteSimilarFeed
          itemType="product"
          categoryQueue={uniqueQueue}
          excludeId={productId}
        />
      </div>
    </div>
  );
}
