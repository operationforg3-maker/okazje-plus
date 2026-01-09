'use client';

import { useEffect, useState } from 'react';
import { searchProductsForLinking } from '@/lib/data';
import { Product } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ProductSuggestionProps {
  onProductSelect: (productId: string) => void;
  dealTitle: string;
}

export default function ProductSuggestion({ onProductSelect, dealTitle }: ProductSuggestionProps) {
  const [searchText, setSearchText] = useState(dealTitle);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    setSearchText(dealTitle);
  }, [dealTitle]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchText) {
        const products = await searchProductsForLinking(searchText);
        setSuggestions(products);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchText]);

  const handleSelect = (product: Product) => {
    setSelectedProduct(product.id);
    setSearchText(product.name);
    onProductSelect(product.id);
    setSuggestions([]);
  }

  return (
    <div className="relative">
      <Input 
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Zacznij pisać, aby wyszukać produkt..."
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-card border rounded-md mt-1 shadow-lg">
          {suggestions.map(product => (
            <li 
              key={product.id} 
              className="px-4 py-2 cursor-pointer hover:bg-accent"
              onClick={() => handleSelect(product)}
            >
              {product.name}
            </li>
          ))}
        </ul>
      )}
      {selectedProduct && <p className="text-sm text-green-600 mt-2">Połączono z produktem: {selectedProduct}</p>}
    </div>
  );
}
