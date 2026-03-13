'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Package, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { withImageProxy } from '@/lib/image-proxy';

interface HomeProductCardProps {
  product: any;
}

function getLocalizedText(value: unknown, fallback = 'Produkt'): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const candidate = localized.pl || localized.en || localized.de;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function getProductImage(product: any): string {
  if (typeof product?.image === 'string' && product.image.trim()) return product.image.trim();
  if (Array.isArray(product?.images) && typeof product.images[0] === 'string') return product.images[0];
  if (Array.isArray(product?.gallery) && product.gallery[0]) {
    const first = product.gallery[0];
    if (typeof first === 'string') return first;
    if (typeof first?.src === 'string' && first.src.trim()) return first.src.trim();
  }
  return '/placeholder.png';
}

function formatPrice(value: any, fallbackCurrency = 'PLN'): string | null {
  if (value && typeof value === 'object' && typeof value.amount === 'number') {
    const currency = typeof value.currency === 'string' && value.currency ? value.currency : fallbackCurrency;
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value.amount);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: fallbackCurrency }).format(value);
  }

  return null;
}

export default function HomeProductCard({ product }: HomeProductCardProps) {
  const title = getLocalizedText(product?.title || product?.name, 'Produkt');
  const href = `/products/${product?.slug || product?.id}`;
  const image = getProductImage(product);
  const price = formatPrice((product as any)?.bestPrice ?? product?.price, product?.currency || 'PLN');
  const rating = typeof product?.rating === 'number'
    ? product.rating
    : typeof product?.ratingCard?.average === 'number'
      ? product.ratingCard.average
      : null;

  return (
    <Link href={href} className="block h-full">
      <Card className="h-full overflow-hidden border-border/60 transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src={withImageProxy(image)}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover"
            loading="lazy"
            quality={70}
          />
        </div>

        <CardContent className="space-y-3 p-4">
          <h3 className="line-clamp-2 min-h-[3rem] text-sm font-semibold leading-6 text-foreground sm:text-base">
            {title}
          </h3>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              {price && <div className="text-lg font-bold text-primary">{price}</div>}
              {!price && (
                <div className="text-sm text-muted-foreground">Sprawdź dostępne oferty</div>
              )}
            </div>

            {rating !== null ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{rating.toFixed(1)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span>Produkt</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}