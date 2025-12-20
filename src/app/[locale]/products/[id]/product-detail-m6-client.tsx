'use client';

import { useState, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Heart,
  ShoppingCart,
  MessageSquare,
  Scale,
} from 'lucide-react';
import { PriceComparisonTable } from '@/components/price-comparison-table';
import { ProductPriceHistoryChart } from '@/components/product-price-history-chart';
import { SpecsTable } from '@/components/specs-table';
import CommentSection from '@/components/comment-section';
import RatingInput from '@/components/rating-input';
import ShareButton from '@/components/share-button';
import { formatPrice } from '@/lib/i18n-utils';
import { useFavorites } from '@/hooks/use-favorites';

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
  const { user } = useAuth();
  const [userRating, setUserRating] = useState<ProductRating | null>(null);
  const [recentRatings, setRecentRatings] = useState<ProductRating[]>(initialRatings);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews' | 'rate'>('description');

  // Use productCore if M6, otherwise use product
  const productData = isM6 ? productCore : product;
  const productId = productData?.id || '';
  
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useFavorites(productId, 'product');

  useEffect(() => {
    fetchRatings();
  }, [productId, user]);

  const fetchRatings = async () => {
    if (user && productId) {
      const rating = await getUserProductRating(productId, user.uid);
      setUserRating(rating);
    }
    if (productId) {
      const ratings = await getProductRatings(productId, 5);
      setRecentRatings(ratings);
    }
  };

  if (!productData) {
    return <div className="page-container py-12 text-center">Loading...</div>;
  }

  // Extract data
  const title = typeof productData.title === 'object' 
    ? (productData.title.pl || productData.title.en || 'Produkt')
    : (productData.name || 'Produkt');
    
  const description = typeof productData.description === 'string'
    ? productData.description
    : (productData.shortDescription?.pl || productData.fullDescription?.pl || '');

  // Images - M6 has images array, legacy has single image
  const images = isM6 
    ? productCore.images.map((url, idx) => ({ id: idx.toString(), src: url, alt: title, type: 'url' as const }))
    : (product.gallery && product.gallery.length > 0 
        ? product.gallery 
        : [{ id: '0', src: product.image, alt: title, type: 'url' as const }]);

  // Price - M6 has bestPrice, legacy has price
  const priceAmount = isM6 ? productCore.bestPrice.amount : (product.price || 0);
  const price = formatPrice(priceAmount, 'PLN');

  // Rating
  const avgRating = isM6 ? productCore.rating.score : (product.ratingCard?.average || 0);
  const ratingCount = isM6 ? productCore.rating.count : (product.ratingCard?.count || 0);

  // Specs - M6 has specs, legacy might have metadata.specifications
  const specs = isM6 
    ? productCore.specs 
    : (product.metadata?.specifications?.reduce((acc: Record<string, string>, spec: any) => {
        const key = spec.key || spec.name || 'Unknown';
        acc[key] = spec.value;
        return acc;
      }, {}) || {});

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="page-container py-4 md:py-8 lg:py-12">
      {/* Breadcrumbs */}
      <div className="mb-4 md:mb-6 flex items-center space-x-2 text-xs md:text-sm text-muted-foreground overflow-x-auto">
        <Link href="/" className="hover:text-foreground transition-colors">
          Strona główna
        </Link>
        <ChevronRight className="w-4 h-4 flex-shrink-0" />
        <Link href="/products" className="hover:text-foreground transition-colors">
          Produkty
        </Link>
        <ChevronRight className="w-4 h-4 flex-shrink-0" />
        <span className="text-foreground font-medium truncate">{title}</span>
      </div>

      {/* Hero Section - Gallery + Price Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 mb-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
            <Image
              src={images[currentImageIndex].src}
              alt={images[currentImageIndex].alt || title}
              fill
              className="object-contain p-4"
              priority
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all"
                  aria-label="Next image"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                    idx === currentImageIndex ? 'border-primary' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Image
                    src={img.src}
                    alt={img.alt || `${title} - ${idx + 1}`}
                    fill
                    className="object-contain p-1"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price Widget & Actions */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              {title}
            </h1>
            
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
          </div>

          {/* Best Price Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Najlepsza cena
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 mb-4">
                {price}
              </div>
              {isM6 && deals.length > 0 && (
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {deals.length} {deals.length === 1 ? 'oferta' : 'oferty'} dostępnych
                  </p>
                  <p className="text-xs text-gray-500">
                    Porównaj ceny od różnych sprzedawców poniżej
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={() => toggleFavorite()}
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={isFavoriteLoading}
            >
              <Heart className={`w-5 h-5 mr-2 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
              {isFavorited ? 'W ulubionych' : 'Dodaj do ulubionych'}
            </Button>
            <ShareButton
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={title}
            />
          </div>
        </div>
      </div>

      {/* Price Comparison Table (M6 only) */}
      {isM6 && deals.length > 0 && (
        <div className="mb-8">
          <PriceComparisonTable productId={productId} deals={deals} />
        </div>
      )}

      {/* Price History Chart (M6 only) */}
      {isM6 && deals.length > 0 && (
        <div className="mb-8">
          <ProductPriceHistoryChart deals={deals} />
        </div>
      )}

      {/* Tabs - Description, Specs, Reviews */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="mb-8">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="description">Opis</TabsTrigger>
          <TabsTrigger value="specs">Specyfikacja</TabsTrigger>
          <TabsTrigger value="reviews">Opinie ({ratingCount})</TabsTrigger>
          <TabsTrigger value="rate">Oceń</TabsTrigger>
        </TabsList>

        <TabsContent value="description" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Opis produktu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-gray max-w-none">
                {description || 'Brak opisu produktu.'}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specs" className="mt-6">
          <SpecsTable specs={specs} title="Specyfikacja techniczna" />
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
                  userRating={userRating}
                  onRatingSubmit={fetchRatings}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">Zaloguj się aby ocenić produkt</p>
                  <Button asChild>
                    <Link href="/login">Zaloguj się</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Comments Section */}
      <div className="mb-8">
        <CommentSection collectionName="products" docId={productId} />
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Podobne produkty</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedProducts.map((relatedProduct) => (
              <Link
                key={relatedProduct.id}
                href={`/products/${relatedProduct.id}`}
                className="group"
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="relative aspect-square mb-4 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={relatedProduct.images?.[0] || relatedProduct.image}
                        alt={relatedProduct.title?.pl || relatedProduct.name}
                        fill
                        className="object-contain p-2 group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <h3 className="font-medium line-clamp-2 mb-2">
                      {relatedProduct.title?.pl || relatedProduct.name}
                    </h3>
                    {relatedProduct.bestPrice && (
                      <p className="text-lg font-bold text-green-600">
                        {formatPrice(relatedProduct.bestPrice.amount, 'PLN')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
