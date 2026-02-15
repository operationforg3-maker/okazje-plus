/**
 * CardHeader Component
 * 
 * Reusable card header with image, badge, favorite button
 * Used by DealCard, ProductCard, and other listing components
 * 
 * Reduces code duplication across card components
 */

'use client';

import React from 'react';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { withImageProxy } from '@/lib/image-proxy';

export interface CardHeaderProps {
  image: string;
  title: string;
  altText?: string;
  badge?: React.ReactNode;
  onFavorite?: (favorited: boolean) => void;
  isFavorited?: boolean;
  isFavoritesLoading?: boolean;
  imageWidth?: number;
  imageHeight?: number;
  imageClassName?: string;
  imageContainerClassName?: string;
  className?: string;
  children?: React.ReactNode;
}

export function CardHeader({
  image,
  title,
  altText = title,
  badge,
  onFavorite,
  isFavorited = false,
  isFavoritesLoading = false,
  imageWidth = 300,
  imageHeight = 200,
  imageClassName,
  imageContainerClassName,
  className,
  children,
}: CardHeaderProps) {
  return (
    <div className={cn('relative bg-muted overflow-hidden rounded-t-lg', className)}>
      {/* Image */}
      <div className={cn('relative h-40 w-full overflow-hidden bg-gradient-to-b from-muted-foreground/5 to-muted', imageContainerClassName)}>
        <Image
          src={withImageProxy(image)}
          alt={altText}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={cn('object-cover transition-transform duration-300 hover:scale-105', imageClassName)}
          loading="lazy"
          quality={75}
        />
      </div>

      {/* Badge overlay (top-left) */}
      {badge && <div className="absolute top-2 left-2">{badge}</div>}

      {/* Favorite button (top-right) */}
      {onFavorite && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onFavorite(!isFavorited);
          }}
          disabled={isFavoritesLoading}
          aria-label={isFavorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          title={isFavorited ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
        >
          <Heart
            className={cn(
              'h-5 w-5 transition-colors',
              isFavorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
            )}
          />
        </Button>
      )}

      {/* Custom children overlay */}
      {children && <div className="absolute inset-0">{children}</div>}
    </div>
  );
}

CardHeader.displayName = 'CardHeader';
