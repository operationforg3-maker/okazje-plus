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
  Heart,
  ShoppingCart,
  MessageSquare,
  Scale,
} from 'lucide-react';
import { PriceComparisonTable } from '@/components/price-comparison-table';
import { ProductPriceHistoryChart } from '@/components/product-price-history-chart';
import { SpecsTable } from '@/components/specs-table';
import GalleryM6 from '@/components/gallery-m6';
import VariantsM6 from '@/components/variants-m6';
import CommentSection from '@/components/comment-section';
import RatingInput from '@/components/rating-input';
import ShareButton from '@/components/share-button';
import { formatPrice } from '@/lib/i18n-utils';
import { useFavorites } from '@/hooks/use-favorites';
import { useSmartCart } from '@/lib/cart-context';

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
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews' | 'rate'>('description');
  const { addItem, isInCart } = useSmartCart();

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
    : ('title' in productData ? productData.title : 'Produkt');
    
  // Spójne rozwiązanie description z page.tsx metadata
  const description = isM6 
    ? (typeof productCore?.description === 'object' ? (productCore.description.pl || productCore.description.en || '') : (typeof productCore?.description === 'string' ? productCore.description : ''))
    : (product?.description || '');

  // Images - M6 has images array, legacy has single image
  const imageUrls = isM6 
    ? productCore?.images && Array.isArray(productCore.images) ? productCore.images : []
    : (product?.gallery && product?.gallery.length > 0 
        ? product?.gallery.map(g => g.src) 
        : [product?.image || '']);

  // Price - M6 has bestPrice, legacy has price
  const priceAmount = isM6 ? (productCore?.bestPrice?.amount || 0) : (product?.price || 0);
  const price = formatPrice(priceAmount, 'PLN');

  // Rating
  const avgRating = isM6 ? (productCore?.rating?.score || 0) : (product?.ratingCard?.average || 0);
  const ratingCount = isM6 ? (productCore?.rating?.count || 0) : (product?.ratingCard?.count || 0);

  // Specs - M6 has specs, legacy might have metadata.specifications
  const specs = isM6 
    ? (productCore?.specs || {})
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

  // Helper: map ProductCore -> minimal Product for SmartCart
  const asLegacyProduct = (): Product => {
    return {
      id: productId,
      name: typeof productData.title === 'object' ? (productData.title.pl || productData.title.en || 'Produkt') : (productData as any).name || 'Produkt',
      image: imageUrls?.[0] || (product as any)?.image || '',
      price: { amount: priceAmount, currency: 'PLN' } as any,
      affiliateUrl: bestDeal?.affiliateLink || (bestDeal as any)?.sourceUrl || (productData as any)?.affiliateUrl,
    } as unknown as Product;
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
        {/* Image Gallery - Using GalleryM6 Component */}
        <GalleryM6 images={imageUrls} title={title} />

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
            {/* Kup teraz */}
            {bestDeal && (
              <Button asChild size="lg" className="flex-1">
                <a href={bestDeal.affiliateLink || (bestDeal as any).sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Kup teraz
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
              {isInCart(productId) ? 'W koszyku' : 'Do koszyka'}
            </Button>
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
                Porównaj
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Product Video (if available) */}
      {isM6 && productCore?.videoUrl && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Wideo produktu</CardTitle>
            <CardDescription>Materiał wideo źródłowy (AliExpress)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
              <video controls className="w-full h-full" src={productCore?.videoUrl} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features / Pros & Cons (if available) */}
      {isM6 && (productCore?.features?.pl?.length || productCore?.pros?.pl?.length || productCore?.cons?.pl?.length) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {productCore?.features?.pl && productCore.features.pl.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cechy produktu</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {productCore?.features?.pl?.map((f, idx) => (
                    <li key={idx} className="text-sm text-gray-700">{f}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {(productCore?.pros?.pl?.length || productCore?.cons?.pl?.length) && (
            <Card>
              <CardHeader>
                <CardTitle>Plusy i minusy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {productCore?.pros?.pl && productCore.pros.pl.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-green-700">Plusy</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {productCore?.pros?.pl?.map((p, idx) => (
                          <li key={idx} className="text-sm text-gray-700">{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {productCore?.cons?.pl && productCore.cons.pl.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-red-700">Minusy</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {productCore?.cons?.pl?.map((c, idx) => (
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
      {isM6 && deals.length > 0 && (
        <div className="mb-8" id="price-comparison">
          <PriceComparisonTable productId={productId} onBuyClick={(deal: any) => {
            // Optional: also add to cart after clicking buy
            try { addItem(asLegacyProduct(), 1); } catch {}
          }} />
        </div>
      )}

      {/* Price History Chart (M6 only) */}
      {isM6 && deals.length > 0 && (
        <div className="mb-8">
          <ProductPriceHistoryChart deals={deals} />
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
                  existingRating={userRating}
                  onRatingSubmitted={fetchRatings}
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
                    {productCore?.qualityScore && (
                      <div><span className="font-medium">Quality Score:</span> <Badge variant={productCore.qualityScore >= 80 ? 'default' : 'secondary'}>{productCore.qualityScore}/100</Badge></div>
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
                      {productCore.rating.distribution && (
                        <>
                          <div className="p-3 bg-muted rounded">
                            <div className="text-2xl font-bold text-green-600">{productCore.rating.distribution['5'] || 0}</div>
                            <div className="text-xs text-muted-foreground">5★</div>
                          </div>
                          <div className="p-3 bg-muted rounded">
                            <div className="text-2xl font-bold text-red-600">{productCore.rating.distribution['1'] || 0}</div>
                            <div className="text-xs text-muted-foreground">1★</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Source Links */}
                {productCore?.sourceLinks && productCore.sourceLinks.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 border-b pb-2">Linki źródłowe ({productCore.sourceLinks.length})</h3>
                    <div className="space-y-2">
                      {productCore.sourceLinks.map((link: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-muted rounded text-sm">
                          <Badge>{link.source || 'unknown'}</Badge>
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-primary hover:underline truncate flex-1"
                          >
                            {link.url}
                          </a>
                          <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      ))}
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
                          <Image src={url} alt={`${title} - zdjęcie ${idx + 1}`} fill className="object-contain" />
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
