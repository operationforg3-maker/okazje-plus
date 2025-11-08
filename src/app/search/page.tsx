'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { searchProductsTypesense, searchDealsTypesense } from '@/lib/search';
import ProductCard from '@/components/product-card';
import DealCard from '@/components/deal-card';
import { Product, Deal } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

export default function SearchPage({ searchParams }: { searchParams: { q: string } }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      if (searchParams.q) {
        setLoading(true);
        try {
          const [productResults, dealResults] = await Promise.all([
            searchProductsTypesense(searchParams.q, { limit: 50 }),
            searchDealsTypesense(searchParams.q, { limit: 50 }),
          ]);
          setProducts(productResults);
          setDeals(dealResults);
        } catch (err) {
          console.error('Search failed:', err);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchResults();
  }, [searchParams.q]);

  const totalResults = products.length + deals.length;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl mb-2">
          Wyniki wyszukiwania
        </h1>
        <p className="text-lg text-muted-foreground">
          Zapytanie: <span className="font-medium text-foreground">"{searchParams.q}"</span>
          {!loading && (
            <span className="ml-2">
              ({totalResults} {totalResults === 1 ? 'wynik' : totalResults < 5 ? 'wyniki' : 'wyników'})
            </span>
          )}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[400px] rounded-lg" />
          ))}
        </div>
      ) : totalResults === 0 ? (
        <div className="text-center py-16">
          <p className="text-xl text-muted-foreground mb-4">
            Nie znaleziono wyników dla "{searchParams.q}"
          </p>
          <p className="text-sm text-muted-foreground">
            Spróbuj użyć innych słów kluczowych lub przeglądnij kategorie
          </p>
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">
              Wszystkie ({totalResults})
            </TabsTrigger>
            <TabsTrigger value="products">
              Produkty ({products.length})
            </TabsTrigger>
            <TabsTrigger value="deals">
              Okazje ({deals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-8">
            {products.length > 0 && (
              <div>
                <h2 className="font-headline text-2xl font-bold mb-4">🛍️ Produkty</h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            )}
            {deals.length > 0 && (
              <div>
                <h2 className="font-headline text-2xl font-bold mb-4">🔥 Okazje</h2>
                <div className="grid grid-cols-1 gap-6">
                  {deals.map((deal) => (
                    <DealCard key={deal.id} deal={deal} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="products">
            {products.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Brak produktów</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deals">
            {deals.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Brak okazji</p>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

