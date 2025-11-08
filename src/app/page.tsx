'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getHotDeals, getRecommendedProducts } from '@/lib/data';
import HeroSection from '@/components/hero-section';
import ProductCard from '@/components/product-card';
import DealCard from '@/components/deal-card';
import { Button } from '@/components/ui/button';
import { Deal, Product } from '@/lib/types';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { StatsStrip } from '@/components/stats-strip';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const [hotDeals, setHotDeals] = useState<Deal[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const { user } = useAuth();
  const [aiTrending, setAiTrending] = useState<Array<{ deal: Deal; prediction: { heatIndex: number; trendingReason: string } | null }>>([]);

  useEffect(() => {
    async function fetchData() {
      setHotDeals(await getHotDeals(4));
      setRecommendedProducts(await getRecommendedProducts(4));
    }
    fetchData();
  }, []);

  useEffect(() => {
    async function fetchAiTrending() {
      try {
        const res = await fetch('/api/trending', { cache: 'no-store' });
        const data = await res.json();
        if (data?.items) setAiTrending(data.items);
      } catch {}
    }
    fetchAiTrending();
  }, []);

  return (
    <div className="flex flex-col gap-12 md:gap-16 lg:gap-24 pb-12 md:pb-16 lg:pb-24">
      <HeroSection />

      <StatsStrip />

      <section className="container mx-auto px-4 md:px-6">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl flex items-center gap-3">
            🔮 Trending przez AI
          </h2>
        </div>
        <div className="relative">
          <Carousel className="w-full">
            <CarouselContent>
              {aiTrending.map(({ deal, prediction }) => (
                <CarouselItem key={deal.id} className="basis-full sm:basis-1/2 lg:basis-1/3">
                  <div className="relative">
                    <DealCard deal={deal} />
                    {prediction && (
                      <div className="absolute top-2 left-2 rounded-md bg-black/70 text-white px-2 py-1 text-xs shadow">
                        AI: {Math.round(prediction.heatIndex)}/100
                      </div>
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </section>

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
        <div className="relative">
          <Carousel className="w-full">
            <CarouselContent>
              {hotDeals.map((deal) => (
                <CarouselItem key={deal.id} className="basis-full sm:basis-1/2 lg:basis-1/4">
                  <DealCard deal={deal} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
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
        <div className="relative">
          <Carousel className="w-full">
            <CarouselContent>
              {recommendedProducts.map((product) => (
                <CarouselItem key={product.id} className="basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                  <ProductCard product={product} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      </section>

      {/* Sekcja o projekcie i CTA rejestracji */}
      <section id="o-projekcie" className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="font-headline text-3xl md:text-4xl font-bold mb-3">O projekcie</h2>
            <p className="text-muted-foreground mb-4">
              Okazje+ to społecznościowa platforma do odkrywania najlepszych promocji. 
              Łączymy Next.js 15, Firebase i Typesense, aby zapewnić szybkie działanie, bezpieczeństwo i trafne wyszukiwanie.
            </p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Szybkie wyszukiwanie pełnotekstowe (Typesense)</li>
              <li>• Oceny produktów i przewidywanie trendów (Genkit AI)</li>
              <li>• System temperatury okazji jak na Pepper</li>
              <li>• Hosting w Firebase (europe-west1)</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="font-headline text-2xl font-semibold mb-4">Dołącz do społeczności</h3>
            <p className="text-muted-foreground mb-6">Zapisz ulubione produkty, oceniaj i zgłaszaj nowe okazje.</p>
            {!user ? (
              <Button asChild size="lg" className="w-full">
                <Link href="/login">Zarejestruj się</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link href="/profile">Przejdź do profilu</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
