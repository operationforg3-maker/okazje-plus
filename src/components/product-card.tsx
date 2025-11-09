"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Star, Tag, TrendingUp, ExternalLink, Heart } from 'lucide-react';
import type { Product } from '@/lib/types';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useFavorites } from '@/hooks/use-favorites';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { isFavorited, isLoading, toggleFavorite } = useFavorites(product.id, 'product');
  
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.price);
  const hasOriginal = typeof (product as any).originalPrice === 'number';
  const original = hasOriginal ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format((product as any).originalPrice) : null;
  const discount = hasOriginal && (product as any).originalPrice > 0
    ? Math.round(100 - (product.price / (product as any).originalPrice) * 100)
    : null;
  const categoryBadge = product.subCategorySlug || product.mainCategorySlug || product.category;
  const avgRating = product.ratingCard.average;
  const ratingCount = product.ratingCard.count;

  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardHeader className="relative p-0">
        <Link href={`/products/${product.id}`} className="block overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
            data-ai-hint={product.imageHint}
            width={600}
            height={400}
            className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
        {avgRating >= 4.5 && (
          <Badge className="absolute right-2 top-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-lg">
            <TrendingUp className="mr-1 h-3 w-3" />
            Top Rated
          </Badge>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-2 top-2 h-8 w-8 rounded-full bg-white/90 shadow-md hover:bg-white hover:scale-110 transition-all"
          onClick={(e) => {
            e.preventDefault();
            toggleFavorite();
          }}
          disabled={isLoading}
        >
          <Heart
            className={`h-4 w-4 transition-all ${
              isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600'
            }`}
          />
        </Button>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 p-4">
        <div className="flex items-center justify-between">
          {categoryBadge && (
            <Badge variant="secondary" className="flex w-fit items-center gap-1">
              <Tag className="h-3 w-3" aria-hidden />
              {categoryBadge}
            </Badge>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>{avgRating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({ratingCount})</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="space-y-2 p-3">
                <p className="text-xs font-semibold">Szczegóły ocen:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span>Trwałość: {product.ratingCard.durability.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span>Jakość/Cena: {product.ratingCard.valueForMoney.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span>Łatwość: {product.ratingCard.easeOfUse.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span>Funkcje: {product.ratingCard.versatility.toFixed(1)}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Link href={`/products/${product.id}`}>
          <h3 className="font-headline text-lg font-semibold leading-tight transition-colors hover:text-primary">
            {product.name}
          </h3>
        </Link>
        
        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <p className="text-xl font-bold text-primary">{price}</p>
          {original && (
            <p className="text-sm text-muted-foreground line-through">{original}</p>
          )}
          {typeof discount === 'number' && discount > 0 && (
            <Badge variant="destructive" className="ml-auto">-{discount}%</Badge>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex items-center justify-between gap-2 border-t bg-muted/30 p-3">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link href={`/products/${product.id}`}>
            Szczegóły
          </Link>
        </Button>
        <Button asChild size="sm" className="flex-1 bg-primary hover:bg-primary/90">
          <a href={product.affiliateUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
            <ExternalLink className="h-3.5 w-3.5" />
            Kup teraz
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
