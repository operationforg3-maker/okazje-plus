"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Star, Tag, TrendingUp, ExternalLink, Heart, MessageSquare } from 'lucide-react';
import { useCommentsCount } from '@/hooks/use-comments-count';
import type { Product } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useFavorites } from '@/hooks/use-favorites';
import ShareButton from '@/components/share-button';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';
import { trackFirestoreView, trackFirestoreClick, trackFirestoreShare } from '@/lib/analytics';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { isFavorited, isLoading, toggleFavorite } = useFavorites(product.id, 'product');
  const { user } = useAuth();
  
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.price);
  const hasOriginal = typeof (product as any).originalPrice === 'number';
  const original = hasOriginal ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format((product as any).originalPrice) : null;
  const discount = hasOriginal && (product as any).originalPrice > 0
    ? Math.round(100 - (product.price / (product as any).originalPrice) * 100)
    : null;
  const categoryBadge = product.subCategorySlug || product.mainCategorySlug || product.category;
  const avgRating = product.ratingCard.average;
  const ratingCount = product.ratingCard.count;
  const liveComments = useCommentsCount('products', product.id, (product as any).commentsCount);

  useEffect(() => {
    // track wyświetlenie karty produktu (raz na sesję per element)
    void trackFirestoreView('product', product.id, user?.uid);
  }, [product.id, user?.uid]);

  const handleDetailClick = () => {
    void trackFirestoreClick('product', product.id, user?.uid);
  };

  const handleAffiliateClick = () => {
    void trackFirestoreClick('product', product.id, user?.uid);
  };

  return (
    <Link 
      href={`/products/${product.id}`} 
      onClick={handleDetailClick}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/50"
    >
      <div className="relative overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          data-ai-hint={product.imageHint}
          width={600}
          height={400}
          className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
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
            e.stopPropagation();
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
      </div>
      
      <div className="flex-grow space-y-3 p-4">
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

        <h3 className="font-headline text-lg font-semibold leading-tight transition-colors group-hover:text-primary">
          {product.name}
        </h3>
        
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
      </div>
      
      <div className="flex items-center justify-between gap-2 border-t bg-muted/30 p-3">
        <ShareButton 
          type="product"
          itemId={product.id}
          title={product.name}
          url={`/products/${product.id}`}
          variant="ghost"
          size="sm"
          onShared={(platform) => trackFirestoreShare('product', product.id, user?.uid, platform)}
        />
        <div className="hidden sm:flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span>{liveComments.count}</span>
          </div>
        </div>
        <Button 
          size="sm" 
          className="gap-1 flex-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(product.affiliateUrl, '_blank', 'noopener,noreferrer');
            handleAffiliateClick();
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Kup teraz
        </Button>
      </div>
    </Link>
  );
}
