'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Package, Star, ArrowUpRight } from 'lucide-react';
import { withImageProxy, isAliExpressImage } from '@/lib/image-proxy';

interface UXRedesignProductCardProps {
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

function getPriceAmount(priceVal: any): number {
  if (typeof priceVal === 'number') return priceVal;
  if (priceVal && typeof priceVal === 'object' && typeof priceVal.amount === 'number') {
    return priceVal.amount;
  }
  if (typeof priceVal === 'string') {
    const parsed = parseFloat(priceVal.replace(/[^0-9.,]/g, '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatPrice(value: number, currency = 'PLN'): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value);
}

export function UXRedesignProductCard({ product }: UXRedesignProductCardProps) {
  const locale = useLocale();
  const title = getLocalizedText(product?.title || product?.name, 'Produkt');
  const href = `/${locale}/products/${product?.slug || product?.id}`;
  const image = getProductImage(product);
  const imageUrl = withImageProxy(image);
  const currency = product?.currency || 'PLN';

  const priceAmount = getPriceAmount(product?.bestPrice ?? product?.price);
  const price = priceAmount > 0 ? formatPrice(priceAmount, currency) : null;

  const rating = typeof product?.rating === 'number'
    ? product.rating
    : typeof product?.ratingCard?.average === 'number'
      ? product.ratingCard.average
      : null;

  const dealsCount = Array.isArray(product?.deals) 
    ? product.deals.length 
    : typeof product?.dealsCount === 'number' 
      ? product.dealsCount 
      : 0;

  return (
    <Link href={href} className="group block h-full">
      <div className="h-full bg-background/60 backdrop-blur-md rounded-2xl border border-border/40 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col relative hover:-translate-y-1">
        {/* Product Image */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 95vw, (max-width: 1024px) 48vw, 320px"
            className="object-cover h-full w-full group-hover:scale-105 transition-all duration-500 ease-out"
            loading="lazy"
            quality={70}
            unoptimized={isAliExpressImage(image)}
          />
          
          {/* Rating Badge */}
          {rating !== null && (
            <div className="absolute left-3 top-3 z-10">
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-background/95 text-foreground shadow-sm border border-border/40">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{rating.toFixed(1)}</span>
              </div>
            </div>
          )}

          {/* Deals Count Badge */}
          {dealsCount > 0 && (
            <div className="absolute right-3 top-3 z-10">
              <span className="bg-primary/95 text-primary-foreground text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
                {dealsCount} {dealsCount === 1 ? 'oferta' : dealsCount < 5 ? 'oferty' : 'ofert'}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h3 className="line-clamp-2 text-sm font-semibold leading-relaxed text-foreground group-hover:text-primary transition-colors duration-200">
              {title}
            </h3>
          </div>

          {/* Price Section */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-col">
              {price ? (
                <>
                  <span className="text-xs text-muted-foreground font-medium">Najlepsza cena</span>
                  <span className="text-lg font-extrabold text-foreground tracking-tight">{price}</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground font-medium">Porównaj oferty</span>
              )}
            </div>

            {/* CTA Arrow */}
            <div className="h-9 w-9 rounded-full bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground text-primary flex items-center justify-center transition-all duration-300 shadow-sm group-hover:shadow-md">
              <ArrowUpRight className="h-4 w-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
