'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product } from '@/lib/types';
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

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

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
  }, [params.id]);

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
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Breadcrumbs */}
      <div className="mb-6 flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary transition-colors">Strona główna</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/products" className="hover:text-primary transition-colors">Produkty</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/products?category=${product.mainCategorySlug}`} className="hover:text-primary transition-colors">
          {product.mainCategorySlug}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{product.name}</span>
      </div>

      {/* Main Product Section */}
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mb-12">
        {/* Product Image */}
        <div className="relative">
          <div className="sticky top-8">
            <div className="relative aspect-[4/3] bg-card rounded-xl shadow-lg overflow-hidden border">
              <Image
                src={product.image}
                alt={product.name}
                data-ai-hint={product.imageHint}
                fill
                className="object-contain p-8"
                priority
              />
            </div>
            {avgRating >= 4.5 && (
              <Badge className="absolute top-4 right-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg">
                <Award className="mr-1 h-4 w-4" />
                Top Rated
              </Badge>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {product.subCategorySlug || product.mainCategorySlug}
              </Badge>
              {product.status === 'approved' && (
                <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
                  <ShieldCheck className="h-3 w-3" />
                  Zweryfikowany
                </Badge>
              )}
            </div>

            <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl mb-4">
              {product.name}
            </h1>

            {/* Rating Summary */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(avgRating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{ratingCount}</span> ocen
              </span>
            </div>

            <p className="text-base text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Price Section */}
          <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-2">
            <CardContent className="p-6">
              <div className="flex items-baseline justify-between mb-4">
                <div className="text-4xl font-bold text-primary">{price}</div>
                <Badge variant="outline" className="text-sm">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  Najlepsza cena
                </Badge>
              </div>
              <div className="flex gap-3">
                <Button size="lg" asChild className="flex-1 bg-primary hover:bg-primary/90">
                  <a href={product.affiliateUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-5 w-5" />
                    Kup teraz
                  </a>
                </Button>
                <Button size="lg" variant="outline">
                  <ThumbsUp className="h-5 w-5" />
                </Button>
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
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="description">Szczegółowy opis</TabsTrigger>
          <TabsTrigger value="reviews">Opinie ({ratingCount})</TabsTrigger>
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

        <TabsContent value="reviews" className="mt-6">
          <CommentSection collectionName="products" docId={params.id} />
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
