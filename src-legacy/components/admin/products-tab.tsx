'use client';

import { useEffect, useState } from 'react';
import { getRecommendedProducts } from "@/lib/data";
import { Product } from '@/lib/types';

export function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function fetchProducts() {
      const recommendedProducts = await getRecommendedProducts(50); // Pobierz 50 najnowszych produktów do panelu admina
      setProducts(recommendedProducts);
    }

    fetchProducts();
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Zarządzaj Produktami</h2>
      {/* TODO: Add product management functionality */}
      <ul>
        {products.map(product => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  );
}