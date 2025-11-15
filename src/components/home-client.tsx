"use client";

import { useState } from 'react';
import { Deal, Product } from '@/lib/types';
import DealCard from '@/components/deal-card';
import ProductCard from '@/components/product-card';
import { trackFirestoreView } from '@/lib/analytics';

interface HomeClientProps {
  initialHotDeals: Deal[];
  initialRecommendedProducts: Product[];
}

// Prosty komponent kliencki – przywraca poprzednią logikę renderowania sekcji
// (minimalna wersja; można rozszerzyć o hero / trending AI kiedy potrzebne)
export default function HomeClient({ initialHotDeals, initialRecommendedProducts }: HomeClientProps) {
  const [hotDeals] = useState<Deal[]>(initialHotDeals);
  const [recommendedProducts] = useState<Product[]>(initialRecommendedProducts);

  return (
    <div className="space-y-10 px-4 py-6 max-w-7xl mx-auto">
      <section>
        <h2 className="text-xl font-semibold mb-4">Gorące okazje</h2>
        {hotDeals.length === 0 && <p className="text-sm text-muted-foreground">Brak zaakceptowanych okazji do wyświetlenia.</p>}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {hotDeals.map(deal => (
            <div key={deal.id} onMouseEnter={() => trackFirestoreView('deal', deal.id)}>
              <DealCard deal={deal} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Polecane produkty</h2>
        {recommendedProducts.length === 0 && <p className="text-sm text-muted-foreground">Brak zaakceptowanych produktów do wyświetlenia.</p>}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {recommendedProducts.map(product => (
            <div key={product.id} onMouseEnter={() => trackFirestoreView('product', product.id)}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}