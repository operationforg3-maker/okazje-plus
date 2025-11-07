'use client';
export const dynamic = 'force-dynamic';


import { useEffect, useState } from 'react';
import { getRecommendedProducts, searchProducts } from '@/lib/data';
import ProductCard from '@/components/product-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Product } from '@/lib/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchProducts() {
      if (searchTerm) {
        const searchResults = await searchProducts(searchTerm);
        setProducts(searchResults);
      } else {
        const recommendedProducts = await getRecommendedProducts(20); // Pobierz 20 rekomendowanych produktów
        setProducts(recommendedProducts);
      }
    }

    const debounce = setTimeout(() => {
      fetchProducts();
    }, 300); // Opóźnienie wyszukiwania o 300ms

    return () => clearTimeout(debounce);
  }, [searchTerm]);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tighter sm:text-5xl">
          Katalog Produktów
        </h1>
        <p className="mt-3 max-w-2xl mx-auto text-muted-foreground md:text-lg">
          Przeglądaj naszą szeroką gamę produktów i znajdź coś dla siebie.
        </p>
      </div>

      <div className="mb-8 p-4 bg-card rounded-lg shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Szukaj w produktach..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <Select>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Sortuj według" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popularity">Popularności</SelectItem>
              <SelectItem value="price_asc">Ceny: rosnąco</SelectItem>
              <SelectItem value="price_desc">Ceny: malejąco</SelectItem>
              <SelectItem value="newest">Najnowsze</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Kategoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="electronics">Elektronika</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="appliances">AGD</SelectItem>
              <SelectItem value="computers">Komputery</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
