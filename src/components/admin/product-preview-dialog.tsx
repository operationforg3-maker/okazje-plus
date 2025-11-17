'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ExternalLink, Package, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

interface ProductPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    title: string;
    description?: string;
    price: number;
    originalPrice?: number;
    imageUrl: string;
    images?: string[];
    productUrl: string;
    rating?: number;
    orders?: number;
    discount?: number;
    currency?: string;
    merchant?: string;
    shipping?: string;
  };
  onImport?: () => void;
}

export function ProductPreviewDialog({ 
  open, 
  onOpenChange, 
  product, 
  onImport 
}: ProductPreviewDialogProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const images = product.images && product.images.length > 0 ? product.images : [product.imageUrl];
  
  const priceInPLN = (product.price * 4).toFixed(2); // Approx conversion
  const originalPriceInPLN = product.originalPrice ? (product.originalPrice * 4).toFixed(2) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Podgląd produktu z AliExpress</DialogTitle>
          <DialogDescription>
            Sprawdź szczegóły przed importem do bazy
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Images */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
              <Image
                src={images[selectedImage] || product.imageUrl}
                alt={product.title}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            
            {/* Thumbnail gallery */}
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {images.slice(0, 10).map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`relative aspect-square rounded border-2 overflow-hidden transition-all ${
                      selectedImage === idx 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Image
                      src={img}
                      alt={`${product.title} - zdjęcie ${idx + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{images.length} zdjęć</span>
              <Badge variant="secondary">
                {product.currency || 'USD'}
              </Badge>
            </div>
          </div>

          {/* Right: Details */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg leading-tight mb-2">
                {product.title}
              </h3>
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {product.description}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-bold text-primary">
                {priceInPLN} PLN
              </div>
              {originalPriceInPLN && (
                <div className="text-lg text-muted-foreground line-through">
                  {originalPriceInPLN} PLN
                </div>
              )}
              {product.discount && product.discount > 0 && (
                <Badge className="bg-red-500">
                  -{product.discount}%
                </Badge>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              ≈ ${product.price} {product.currency || 'USD'}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              {product.rating !== undefined && product.rating > 0 && (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <div>
                    <div className="font-semibold">{product.rating.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Ocena</div>
                  </div>
                </div>
              )}
              {product.orders !== undefined && product.orders > 0 && (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-semibold">{product.orders.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Zamówień</div>
                  </div>
                </div>
              )}
            </div>

            {/* Merchant & Shipping */}
            {(product.merchant || product.shipping) && (
              <div className="space-y-2 text-sm">
                {product.merchant && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Sprzedawca:</span>
                    <span className="font-medium">{product.merchant}</span>
                  </div>
                )}
                {product.shipping && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Kategoria:</span>
                    <span className="font-medium">{product.shipping}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(product.productUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Zobacz na AliExpress
              </Button>
              {onImport && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    onImport();
                    onOpenChange(false);
                  }}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Importuj
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
