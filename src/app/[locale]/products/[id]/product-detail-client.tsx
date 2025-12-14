'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product, ProductRating } from '@/lib/types';
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
  ShieldCheck, 
  TrendingUp,
  Package,
  Award,
  Sparkles,
  ThumbsUp,
  Truck,
  Clock,
  MapPin,
  RefreshCcw,
  AlertTriangle,
  Zap,
  Tag,
  Info,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Heart,
  Scale,
  ShoppingCart,
  MessageSquare,
} from 'lucide-react';
import ProductCard from '@/components/product-card';
import CommentSection from '@/components/comment-section';
import RatingInput from '@/components/rating-input';
import ShareButton from '@/components/share-button';
import { SimilarItemsCarousel } from '@/components/similar-items-carousel';
import AIExpertSummary from '@/components/ai-expert-summary';
import { PriceHistoryChart } from '@/components/price-history-chart';
import { getTotalPrice, getPriceAmount, formatPrice } from '@/lib/i18n-utils';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SpecCardGrid } from '@/components/spec-card-grid';
import { useComparison } from '@/components/deal-comparison-tool';
import { useFavorites } from '@/hooks/use-favorites';
import { useSmartCart } from '@/lib/cart-context';

interface Props {
  product: Product;
  relatedProducts: Product[];
  recentRatings: ProductRating[];
}

export default function ProductDetailClient({ product, relatedProducts, recentRatings: initialRatings }: Props) {
  const { user } = useAuth();
  const [userRating, setUserRating] = useState<ProductRating | null>(null);
  const [recentRatings, setRecentRatings] = useState<ProductRating[]>(initialRatings);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { addToComparison } = useComparison();
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(product.id, 'product');
  const { addItem, isInCart } = useSmartCart();
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'rate' | 'external-reviews'>('description');

  const fetchRatings = async () => {
    if (user) {
      const rating = await getUserProductRating(product.id, user.uid);
      setUserRating(rating);
    }
    const ratings = await getProductRatings(product.id, 5);
    setRecentRatings(ratings);
  };

  const currentPrice = getTotalPrice(product.price);
  const itemPrice = getPriceAmount(product.price);
  const price = formatPrice(currentPrice, 'PLN');
  const originalPrice = (product as any).originalPrice 
    ? formatPrice((product as any).originalPrice, 'PLN')
    : null;
  const discount = (product as any).originalPrice && (product as any).originalPrice > currentPrice
    ? Math.round((((product as any).originalPrice - currentPrice) / (product as any).originalPrice) * 100)
    : null;
  const savings = (product as any).originalPrice && (product as any).originalPrice > currentPrice
    ? formatPrice((product as any).originalPrice - currentPrice, 'PLN')
    : null;

  const avgRating = product.ratingCard.average;
  const ratingCount = product.ratingCard.count;

  // Galeria - użyj product.gallery jeśli istnieje, fallback do głównego obrazka
  const images = product.gallery && product.gallery.length > 0 
    ? product.gallery 
    : [{ id: '0', src: product.image, alt: product.name, type: 'url' as const }];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // External rating (z AliExpress lub innych źródeł)
  const externalRating = product.ratingSources?.external;
  const hasExternalRating = Boolean(externalRating && externalRating.average > 0);

  // Specyfikacje techniczne
  const specifications = product.metadata?.specifications || [];
  
  // Stock status
  const stockStatus = product.metadata?.stockStatus;
  const isInStock = !stockStatus || stockStatus === 'in_stock';
  const isLowStock = stockStatus === 'low_stock';
  const isOutOfStock = stockStatus === 'out_of_stock';

  const handleAddToSharedCart = async () => {
    setIsAddingToCart(true);
    try {
      addItem(product, 1);
      await new Promise((resolve) => setTimeout(resolve, 400));
    } finally {
      setIsAddingToCart(false);
    }
  };

  const scrollToOpinions = (targetTab: typeof activeTab) => {
    setActiveTab(targetTab);
    setTimeout(() => {
      document.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const isProductInCart = isInCart(product.id);

  return (
    <div className="page-container py-4 md:py-8 lg:py-12">
      {/* Breadcrumbs */}
      <div className="mb-4 md:mb-6 flex items-center space-x-2 text-xs md:text-sm text-muted-foreground overflow-x-auto">
        <Link href="/" className="hover:text-primary transition-colors whitespace-nowrap">Strona główna</Link>
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <Link href="/products" className="hover:text-primary transition-colors whitespace-nowrap">Produkty</Link>
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <Link href={`/products?category=${product.mainCategorySlug}`} className="hover:text-primary transition-colors whitespace-nowrap">
          {product.mainCategorySlug}
        </Link>
        {product.subCategorySlug && (
          <>
            <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
            <Link href={`/products?category=${product.mainCategorySlug}&sub=${product.subCategorySlug}`} className="hover:text-primary transition-colors whitespace-nowrap">
              {product.subCategorySlug}
            </Link>
          </>
        )}
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <span className="font-medium text-foreground truncate max-w-[200px]">{product.name}</span>
      </div>

      {/* Main Product Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 mb-8 md:mb-12">
        {/* Product Image Gallery */}
        <div className="relative">
          <div className="md:sticky md:top-8 space-y-4">
            <div className="relative aspect-[4/3] bg-card rounded-xl shadow-lg overflow-hidden border">
              <Image
                src={images[currentImageIndex].src}
                alt={images[currentImageIndex].alt || product.name}
                fill
                className="object-contain p-4 md:p-8"
                priority
              />
              
              {/* Gallery navigation */}
              {images.length > 1 && (
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
                  
                  {/* Image counter */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}

              {/* Badges */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                {avgRating >= 4.5 && (
                  <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg text-xs md:text-sm">
                    <Award className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                    Top Rated
                  </Badge>
                )}
                {discount && discount > 0 && (
                  <Badge variant="destructive" className="shadow-lg text-sm">
                    -{discount}%
                  </Badge>
                )}
                {product.metadata?.hotProduct && (
                  <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg animate-pulse">
                    <Zap className="mr-1 h-3 w-3" />
                    HOT
                  </Badge>
                )}
                {product.metadata?.flashDeal && (
                  <Badge className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg">
                    <Zap className="mr-1 h-3 w-3" />
                    Flash Deal
                  </Badge>
                )}
              </div>

              {/* Stock status badge */}
              {isLowStock && (
                <Badge variant="outline" className="absolute top-4 left-4 border-yellow-600 text-yellow-600 bg-yellow-50">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Niski stan
                </Badge>
              )}
              {isOutOfStock && (
                <Badge variant="outline" className="absolute top-4 left-4 border-red-600 text-red-600 bg-red-50">
                  <XCircle className="mr-1 h-3 w-3" />
                  Wyprzedane
                </Badge>
              )}
            </div>

            {/* Thumbnail gallery */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((img, idx) => (
                  <button
                    key={img.id || idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`relative flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all ${
                      idx === currentImageIndex ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Image
                      src={img.src}
                      alt={img.alt || `${product.name} ${idx + 1}`}
                      fill
                      className="object-contain p-1"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col space-y-4 md:space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <Package className="h-3 w-3" />
                {product.subSubCategorySlug || product.subCategorySlug || product.mainCategorySlug}
              </Badge>
              {product.status === 'approved' && (
                <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600 text-xs">
                  <ShieldCheck className="h-3 w-3" />
                  Zweryfikowany
                </Badge>
              )}
              {product.metadata?.promotionId && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-purple-600 text-white text-xs">
                  <Tag className="h-3 w-3" />
                  Promocja
                </Badge>
              )}
            </div>

            <h1 className="font-headline text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight mb-3 md:mb-4 break-words">
              {product.name}
            </h1>

            {/* Rating Summary */}
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={`rating-star-${i}`}
                      className={`h-4 w-4 md:h-5 md:w-5 ${
                        i < Math.floor(avgRating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xl md:text-2xl font-bold">{avgRating.toFixed(1)}</span>
              </div>
              <Separator orientation="vertical" className="h-6 md:h-8" />
              <span className="text-sm md:text-base text-muted-foreground">
                <span className="font-semibold text-foreground">{ratingCount}</span> ocen
              </span>
              
              {/* External rating (AliExpress) */}
              {hasExternalRating && externalRating && (
                <>
                  <Separator orientation="vertical" className="h-6 md:h-8" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <ExternalLink className="h-3 w-3" />
                          {externalRating.average.toFixed(1)}/5
                          {externalRating.count && ` (${externalRating.count})`}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Ocena z {externalRating.source}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>

            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              {product.description}
            </p>

            {/* Spec cards highlight */}
            {specifications && specifications.length > 0 && (
              <SpecCardGrid
                specs={specifications.map((s: any) => ({
                  key: s.key || s.name,
                  label: s.name || s.key,
                  value: s.value,
                }))}
                title="Kluczowe parametry"
                className="mt-4"
              />
            )}

            {/* AI Features */}
            {product.ai?.enrichment?.features && product.ai.enrichment.features.length > 0 && (
              <ul className="mt-4 space-y-2">
                {product.ai.enrichment.features.slice(0, 5).map((feature, idx) => (
                  <li key={`feature-${idx}-${feature.substring(0,15)}`} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Delivery & Logistics Info */}
          {(product.metadata?.deliveryTime || product.metadata?.warehouse || product.metadata?.shippingMethod || product.metadata?.freeShipping) && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Dostawa i wysyłka
                </h3>
                {product.metadata.freeShipping && (
                  <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Darmowa wysyłka
                  </div>
                )}
                {product.metadata.deliveryTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Dostawa: {product.metadata.deliveryTime}</span>
                  </div>
                )}
                {product.metadata.warehouse && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>Wysyłka z: {product.metadata.warehouse}</span>
                  </div>
                )}
                {product.metadata.shippingMethod && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{product.metadata.shippingMethod}</span>
                  </div>
                )}
                {product.metadata.returnPolicy && (
                  <div className="flex items-center gap-2 text-sm">
                    <RefreshCcw className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {typeof product.metadata.returnPolicy === 'string' 
                        ? product.metadata.returnPolicy 
                        : product.metadata.returnPolicy.allowed 
                          ? `Zwroty do ${product.metadata.returnPolicy.days} dni`
                          : 'Bez zwrotów'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Price Section */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-2 border-primary/20">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-baseline justify-between mb-3 md:mb-4 flex-wrap gap-2">
                <div>
                  <div className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary">{price}</div>
                  {originalPrice && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg text-muted-foreground line-through">{originalPrice}</span>
                      {savings && (
                        <span className="text-sm font-semibold text-green-600">Oszczędzasz {savings}</span>
                      )}
                    </div>
                  )}
                </div>
                {isInStock && (
                  <Badge variant="outline" className="text-xs md:text-sm border-green-600 text-green-600">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Dostępny
                  </Badge>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  size="lg" 
                  asChild 
                  className="flex-1 bg-primary hover:bg-primary/90 w-full sm:w-auto text-base md:text-lg py-6"
                  disabled={isOutOfStock}
                >
                  <a href={product.affiliateUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-5 w-5" />
                    {isOutOfStock ? 'Wyprzedane' : 'Kup teraz'}
                  </a>
                </Button>
                <ShareButton 
                  type="product"
                  itemId={product.id}
                  title={product.name}
                  url={`/products/${product.id}`}
                  size="lg"
                  variant="outline"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Link afiliacyjny - wspierasz naszą platformę
              </p>

              {/* Action strip: wspólny koszyk, porównanie, ulubione, opinie */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  variant={isProductInCart ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={handleAddToSharedCart}
                  disabled={isAddingToCart}
                  className="justify-center"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {isProductInCart ? 'Wspólny koszyk' : isAddingToCart ? 'Dodawanie...' : 'Dodaj do koszyka'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addToComparison({ ...product, type: 'product' })}
                  className="justify-center"
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Porównaj
                </Button>
                <Button
                  variant={isFavorited ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => toggleFavorite()}
                  disabled={isFavoriteLoading}
                  className="justify-center"
                >
                  <Heart className={`h-4 w-4 mr-2 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                  Ulubione
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => scrollToOpinions('reviews')}
                  className="col-span-2 sm:col-span-4 justify-center"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Opinie i komentarze
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Rating Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-amber-400" />
                Szczegółowe oceny
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Trwałość', value: product.ratingCard.durability },
                { label: 'Łatwość użycia', value: product.ratingCard.easeOfUse },
                { label: 'Stosunek jakości do ceny', value: product.ratingCard.valueForMoney },
                { label: 'Wszechstronność', value: product.ratingCard.versatility },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-semibold">{value.toFixed(1)}/5.0</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all"
                      style={{ width: `${(value / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="mb-12">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="description">Opis i specyfikacja</TabsTrigger>
          <TabsTrigger value="reviews">Opinie ({ratingCount})</TabsTrigger>
          <TabsTrigger value="rate">Oceń produkt</TabsTrigger>
        </TabsList>
        
        <TabsContent value="description" className="mt-6 space-y-6">
          
          {/* ========================================
              💎 AI EXPERT SUMMARY (M4 Trust-First)
              ======================================== */}
          <AIExpertSummary product={product} />

          {/* ========================================
              📊 PRICE HISTORY (30-Day Tracking)
              ======================================== */}
          <PriceHistoryChart itemId={product.id} itemType="product" />

          {/* Long description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                O produkcie
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                {product.longDescription || product.description}
              </p>
            </CardContent>
          </Card>

          {/* Technical specifications */}
          {specifications && specifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Specyfikacja techniczna
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {specifications.map((spec, idx) => (
                    <div key={`spec-${idx}-${spec.key}`} className="border-b pb-2">
                      <dt className="text-sm font-medium text-muted-foreground">{spec.key}</dt>
                      <dd className="mt-1 text-sm font-semibold">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Delivery & Warehouse info from AliExpress */}
          {(product.metadata?.warehouse || product.metadata?.deliveryTime || product.metadata?.shippingMethod) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Informacje o dostawie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.metadata.warehouse && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm"><strong>Magazyn:</strong> {product.metadata.warehouse}</span>
                  </div>
                )}
                {product.metadata.deliveryTime && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm"><strong>Czas dostawy:</strong> {product.metadata.deliveryTime}</span>
                  </div>
                )}
                {product.metadata.shippingMethod && (
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm"><strong>Metoda wysyłki:</strong> {product.metadata.shippingMethod}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 🚀 ENHANCED SHIPPING INFO (from Auto-Import Kombajn) */}
          {((product.metadata as any)?.shipping) && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Truck className="h-5 w-5" />
                  Szczegóły dostawy do Polski
                </CardTitle>
                <CardDescription>Obliczone przez AliExpress API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(product.metadata as any).shipping.cost !== undefined && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span className="text-sm font-medium">Koszt wysyłki:</span>
                    <span className="text-lg font-bold text-blue-900">
                      {(product.metadata as any).shipping.cost > 0 
                        ? `${(product.metadata as any).shipping.cost} PLN` 
                        : 'DARMOWA'}
                    </span>
                  </div>
                )}
                {(product.metadata as any).shipping.estimatedDays && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span className="text-sm font-medium">Szacowany czas dostawy:</span>
                    <span className="text-base font-semibold">~{(product.metadata as any).shipping.estimatedDays} dni</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 💎 PRODUCT VARIANTS (SKU Details from Auto-Import) */}
          {((product.metadata as any)?.variants && (product.metadata as any).variants.length > 0) && (
            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Package className="h-5 w-5" />
                  Dostępne warianty ({(product.metadata as any).variants.length})
                </CardTitle>
                <CardDescription>Różne rozmiary, kolory i opcje</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(product.metadata as any).variants.slice(0, 8).map((variant: any, idx: number) => (
                    <div key={variant.skuId || idx} className="p-3 bg-white rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          Wariant #{idx + 1}
                        </span>
                        <Badge variant={variant.available ? 'default' : 'secondary'}>
                          {variant.available ? 'Dostępny' : 'Brak'}
                        </Badge>
                      </div>
                      {variant.attributes && variant.attributes.length > 0 && (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {variant.attributes.map((attr: any, attrIdx: number) => (
                            <div key={attrIdx}>
                              {attr.name || attr.key}: <span className="font-medium text-foreground">{attr.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {variant.price && (
                        <div className="mt-2 text-base font-bold text-purple-900">
                          {variant.price} PLN
                        </div>
                      )}
                      {variant.stock && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Dostępne: {variant.stock} szt.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {(product.metadata as any).variants.length > 8 && (
                  <p className="mt-3 text-sm text-muted-foreground text-center">
                    +{(product.metadata as any).variants.length - 8} więcej wariantów dostępnych u sprzedawcy
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 🛡️ WARRANTY & PACKAGE INFO */}
          {(((product.metadata as any)?.warranty?.available) || ((product.metadata as any)?.package)) && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <ShieldCheck className="h-5 w-5" />
                  Gwarancja i informacje o paczce
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(product.metadata as any).warranty?.available && (
                  <div className="p-3 bg-white rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-semibold">Gwarancja dostępna</span>
                    </div>
                    {(product.metadata as any).warranty.description && (
                      <p className="text-sm text-muted-foreground pl-7">
                        {(product.metadata as any).warranty.description}
                      </p>
                    )}
                  </div>
                )}
                {(product.metadata as any).package && (
                  <div className="p-3 bg-white rounded-lg space-y-2">
                    <div className="font-semibold text-sm mb-2">Wymiary i waga paczki:</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {(product.metadata as any).package.weight && (
                        <div>
                          <span className="text-muted-foreground">Waga:</span> 
                          <span className="font-medium ml-2">{(product.metadata as any).package.weight}kg</span>
                        </div>
                      )}
                      {(product.metadata as any).package.length && (
                        <div>
                          <span className="text-muted-foreground">Długość:</span> 
                          <span className="font-medium ml-2">{(product.metadata as any).package.length}cm</span>
                        </div>
                      )}
                      {(product.metadata as any).package.width && (
                        <div>
                          <span className="text-muted-foreground">Szerokość:</span> 
                          <span className="font-medium ml-2">{(product.metadata as any).package.width}cm</span>
                        </div>
                      )}
                      {(product.metadata as any).package.height && (
                        <div>
                          <span className="text-muted-foreground">Wysokość:</span> 
                          <span className="font-medium ml-2">{(product.metadata as any).package.height}cm</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Keywords */}
          {product.ai?.enrichment?.keywords && product.ai.enrichment.keywords.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="h-4 w-4" />
                  Powiązane wyszukiwania
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {product.ai.enrichment.keywords.map((keyword, idx) => (
                    <Badge key={`keyword-${keyword}-${idx}`} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-6 space-y-6" id="product-reviews">
          {/* Recent user ratings */}
          {recentRatings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ostatnie oceny użytkowników</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentRatings.map((rating) => (
                  <div key={rating.id} className="border-l-4 border-primary pl-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">
                        {rating.userDisplayName || `Użytkownik ${rating.userId.substring(0, 6)}...`}
                      </p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={`review-star-${rating.id}-${i}`}
                            className={`h-4 w-4 ${
                              i < rating.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground'
                            }`}
                          />
                        ))}
                        <span className="ml-1 text-sm font-semibold">{rating.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    {rating.review && (
                      <p className="text-sm text-muted-foreground">{rating.review}</p>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Trwałość: {rating.durability.toFixed(1)}</span>
                      <span>Łatwość: {rating.easeOfUse.toFixed(1)}</span>
                      <span>Jakość/Cena: {rating.valueForMoney.toFixed(1)}</span>
                      <span>Funkcje: {rating.versatility.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <CommentSection collectionName="products" docId={product.id} />
        </TabsContent>

        {/* External Reviews from AliExpress */}
        {hasExternalRating && externalRating && (
          <TabsContent value="external-reviews" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Opinie z AliExpress
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={`ext-star-${i}`}
                        className={`h-5 w-5 ${
                          i < Math.floor(externalRating?.average || 0)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-xl font-bold">{externalRating?.average?.toFixed(1) || 'N/A'}</span>
                  </div>
                </div>
                <CardDescription>
                  {externalRating?.count ? `Liczba ocen: ${externalRating.count.toLocaleString('pl-PL')}` : 'Oceny z platformy AliExpress'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted/50 p-6 text-center space-y-3">
                  <Info className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Opinie pochodzą z platformy AliExpress. Pełne recenzje dostępne są na stronie sprzedawcy.
                  </p>
                  <Button asChild variant="outline" className="mt-4">
                    <a href={product.affiliateUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Zobacz opinie na AliExpress
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="rate" className="mt-6" id="product-rate">
          <RatingInput
            productId={product.id}
            existingRating={userRating}
            onRatingSubmitted={fetchRatings}
          />
        </TabsContent>
      </Tabs>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <>
          <Separator className="my-12" />
          <section>
            <h2 className="font-headline text-2xl font-bold mb-6 flex items-center gap-2">
              <Package className="h-6 w-6" />
              Podobne produkty
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProducts.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* AI-Powered Similar Items Carousel */}
      <SimilarItemsCarousel
        itemId={product.id}
        itemType="product"
        category={product.mainCategorySlug}
        subcategory={product.subCategorySlug}
        priceRange={currentPrice ? [currentPrice * 0.7, currentPrice * 1.3] : undefined}
        excludeItemId={product.id}
        maxItems={8}
      />
    </div>
  );
}
