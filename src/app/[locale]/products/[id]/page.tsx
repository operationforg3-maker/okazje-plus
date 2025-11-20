'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  ThumbsUp
} from 'lucide-react';
import ProductCard from '@/components/product-card';
import CommentSection from '@/components/comment-section';
import RatingInput from '@/components/rating-input';
import ShareButton from '@/components/share-button';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [userRating, setUserRating] = useState<ProductRating | null>(null);
  const [recentRatings, setRecentRatings] = useState<ProductRating[]>([]);

  const fetchRatings = async () => {
    if (user) {
      const rating = await getUserProductRating(params.id, user.uid);
      setUserRating(rating);
    }
    const ratings = await getProductRatings(params.id, 5);
    setRecentRatings(ratings);
  };

  useEffect(() => {
    async function fetchProduct() {
      const docRef = doc(db, "products", params.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const productData = { id: docSnap.id, ...docSnap.data() } as Product;
        setProduct(productData);

        // Fetch related products from same subcategory
        const relatedQuery = query(
          collection(db, "products"),
          where("subCategorySlug", "==", productData.subCategorySlug),
          where("status", "==", "approved"),
          limit(4)
        );
        const relatedSnap = await getDocs(relatedQuery);
        const related = relatedSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => p.id !== params.id)
          .slice(0, 3);
        setRelatedProducts(related);
      } else {
        notFound();
      }
    }
    fetchProduct();
    fetchRatings();
  }, [params.id, user]);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-3/4"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.price);
  const avgRating = product.ratingCard.average;
  const ratingCount = product.ratingCard.count;

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 lg:py-12">
      {/* Breadcrumbs */}
      <div className="mb-4 md:mb-6 flex items-center space-x-2 text-xs md:text-sm text-muted-foreground overflow-x-auto">
        <Link href="/" className="hover:text-primary transition-colors whitespace-nowrap">Strona główna</Link>
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <Link href="/products" className="hover:text-primary transition-colors whitespace-nowrap">Produkty</Link>
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <Link href={`/products?category=${product.mainCategorySlug}`} className="hover:text-primary transition-colors whitespace-nowrap">
          {product.mainCategorySlug}
        </Link>
        <ChevronRight className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
        <span className="font-medium text-foreground truncate">{product.name}</span>
      </div>

      {/* Main Product Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 mb-8 md:mb-12">
        {/* Product Image */}
        <div className="relative">
          <div className="md:sticky md:top-8">
            <div className="relative aspect-[4/3] bg-card rounded-xl shadow-lg overflow-hidden border">
              <Image
                src={product.image}
                alt={product.name}
                data-ai-hint={product.imageHint}
                fill
                className="object-contain p-4 md:p-8"
                priority
              />
            </div>
            {avgRating >= 4.5 && (
              <Badge className="absolute top-4 right-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg text-xs md:text-sm">
                <Award className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                Top Rated
              </Badge>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col space-y-4 md:space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <Package className="h-3 w-3" />
                {product.subCategorySlug || product.mainCategorySlug}
              </Badge>
              {product.status === 'approved' && (
                <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600 text-xs">
                  <ShieldCheck className="h-3 w-3" />
                  Zweryfikowany
                </Badge>
              )}
            </div>

            <h1 className="font-headline text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight mb-3 md:mb-4">
              {product.name}
            </h1>

            {/* Rating Summary */}
            <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
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
            </div>

            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Price Section */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-2">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-baseline justify-between mb-3 md:mb-4">
                <div className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary">{price}</div>
                <Badge variant="outline" className="text-xs md:text-sm">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  Najlepsza cena
                </Badge>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" asChild className="flex-1 bg-primary hover:bg-primary/90 w-full sm:w-auto">
                  <a href={product.affiliateUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                    Kup teraz
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
            </CardContent>
          </Card>

          {/* Rating Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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
      <Tabs defaultValue="description" className="mb-12">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="description">Szczegółowy opis</TabsTrigger>
          <TabsTrigger value="reviews">Opinie ({ratingCount})</TabsTrigger>
          <TabsTrigger value="rate">Oceń produkt</TabsTrigger>
        </TabsList>
        
        <TabsContent value="description" className="mt-6">
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
        </TabsContent>

        <TabsContent value="reviews" className="mt-6 space-y-6">
          {/* Ostatnie oceny użytkowników */}
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
                            key={i}
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

          <CommentSection collectionName="products" docId={params.id} />
        </TabsContent>

        <TabsContent value="rate" className="mt-6">
          <RatingInput
            productId={params.id}
            existingRating={userRating}
            onRatingSubmitted={() => {
              // Odśwież dane produktu i oceny
              fetchRatings();
              if (product) {
                getDoc(doc(db, "products", params.id)).then(docSnap => {
                  if (docSnap.exists()) {
                    setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
                  }
                });
              }
            }}
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
    </div>
  );
}
