'use client';

import { useEffect, useState } from 'react';
import { searchProducts } from '@/lib/data';
import ProductCard from '@/components/product-card';
import { Product } from '@/lib/types';

export default function SearchPage({ searchParams }: { searchParams: { q: string } }) {
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    async function fetchResults() {
      if (searchParams.q) {
        setResults(await searchProducts(searchParams.q));
      }
    }
    fetchResults();
  }, [searchParams.q]);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl mb-8">
        Wyniki wyszukiwania dla "{searchParams.q}"
      </h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {results.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
