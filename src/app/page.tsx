'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getHotDeals, getRecommendedProducts } from '@/lib/data';
import HeroSection from '@/components/hero-section';
import ProductCard from '@/components/product-card';
import DealCard from '@/components/deal-card';
import { Button } from '@/components/ui/button';
import { Deal, Product } from '@/lib/types';

export default function Home() {
  const [hotDeals, setHotDeals] = useState<Deal[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function fetchData() {
      setHotDeals(await getHotDeals(4));
      setRecommendedProducts(await getRecommendedProducts(4));
    }
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-12 md:gap-16 lg:gap-24 pb-12 md:pb-16 lg:pb-24">
      <HeroSection />

      <section className="container mx-auto px-4 md:px-6">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl flex items-center gap-3">
            🎯 Gorące Okazje
          </h2>
          <Button variant="ghost" asChild>
            <Link href="/deals">
              Zobacz wszystkie <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {hotDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 md:px-6">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl flex items-center gap-3">
            🛍️ Polecane Produkty
          </h2>
          <Button variant="ghost" asChild>
            <Link href="/products">
              Zobacz wszystkie <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {recommendedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
