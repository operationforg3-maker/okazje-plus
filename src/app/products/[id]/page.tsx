'use client';
export const dynamic = 'force-dynamic';


import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ChevronRight, ShoppingCart, ShieldCheck } from 'lucide-react';
import ProductCard from '@/components/product-card';
import { Separator } from '@/components/ui/separator';
import CommentSection from '@/components/comment-section';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  // Add related products logic here if needed

  useEffect(() => {
    async function fetchProduct() {
      const docRef = doc(db, "products", params.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
      } else {
        notFound();
      }
    }
    fetchProduct();
  }, [params.id]);

  if (!product) {
    return <div>Loading...</div>; // Or a proper loading skeleton
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-6 flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Strona główna</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/products" className="hover:text-primary">Produkty</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{product.name}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="p-4 bg-card rounded-lg shadow-sm flex items-center justify-center">
          <Image
            src={product.image}
            alt={product.name}
            width={600}
            height={400}
            className="rounded-lg object-contain max-h-[500px]"
          />
        </div>
        <div className="flex flex-col justify-center">
          <Badge variant="secondary" className="w-fit mb-2">{product.category}</Badge>
          <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
            {product.name}
          </h1>
          {/* Ratings and other details will be dynamic */}

          <p className="mt-6 text-base text-muted-foreground leading-relaxed">
            {product.description}
          </p>
          
          <div className="mt-8">
             <div className="text-4xl font-bold text-primary">
                {product.price} zł
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <Button size="lg" asChild className="bg-accent hover:bg-accent/90 flex-1">
              <a href={product.affiliateUrl} target="_blank" rel="noopener noreferrer">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Znajdź najlepszą okazję
              </a>
            </Button>
            <Button size="lg" variant="outline" className="flex-1">
              Dodaj do obserwowanych
            </Button>
          </div>
        </div>
      </div>

      <Separator className="my-12 md:my-16" />
      
      <CommentSection collectionName="products" docId={params.id} />

      {/* Related products section can be added here */}
    </div>
  );
}
