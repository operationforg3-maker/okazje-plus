'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Flame, Store, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { withImageProxy } from '@/lib/image-proxy';

interface UXRedesignDealCardProps {
  deal: any;
  priority?: boolean;
}

function getLocalizedText(value: unknown, fallback = 'Oferta'): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const localized = value as Record<string, unknown>;
    const candidate = localized.pl || localized.en || localized.de;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

function getDealImage(deal: any): string {
  const candidates = [
    deal?.image,
    deal?.imageUrl,
    deal?.mainImage,
    deal?.product_main_image_url,
    deal?.thumbnail,
    deal?.metadata?.image,
    deal?.metadata?.imageUrl,
    deal?.metadata?.mainImage,
    Array.isArray(deal?.gallery) ? deal.gallery[0] : undefined,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }

  return '/icon_okazjeplus.svg';
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

export function UXRedesignDealCard({ deal, priority = false }: UXRedesignDealCardProps) {
  const locale = useLocale();
  const title = getLocalizedText(deal?.title, 'Oferta');
  const image = getDealImage(deal);
  const imageUrl = withImageProxy(image);
  const href = `/${locale}/deals/${deal?.id}`;
  const source = getLocalizedText(deal?.merchant || deal?.metadata?.merchant || deal?.source, 'Sklep');
  const currency = deal?.currency || 'PLN';

  const priceAmount = getPriceAmount(deal?.price ?? deal?.legacyPrice);
  const originalPriceAmount = getPriceAmount(deal?.originalPrice);

  const price = priceAmount > 0 ? formatPrice(priceAmount, currency) : null;
  const originalPrice = originalPriceAmount > 0 ? formatPrice(originalPriceAmount, currency) : null;

  const discountPercent = originalPriceAmount > priceAmount && originalPriceAmount > 0
    ? Math.round(((originalPriceAmount - priceAmount) / originalPriceAmount) * 100)
    : null;

  const temperature = typeof deal?.temperature === 'number' ? Math.round(deal.temperature) : 0;
  const isHot = temperature >= 100;

  return (
    <Link href={href} className="group block h-full">
      <div className="h-full bg-background/60 backdrop-blur-md rounded-2xl border border-border/40 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col relative hover:-translate-y-1">
        {/* Card Image Area */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 95vw, (max-width: 1024px) 48vw, 320px"
            className="object-cover h-full w-full group-hover:scale-105 transition-all duration-500 ease-out"
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            quality={70}
          />
          
          {/* Temperature Badge */}
          <div className="absolute left-3 top-3 z-10">
            <div className={cn(
              "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shadow-md transition-all",
              isHot 
                ? "bg-gradient-to-r from-red-500 to-orange-500 text-white animate-pulse shadow-orange-500/20" 
                : "bg-background/95 text-foreground border border-border/50"
            )}>
              <Flame className={cn("h-3.5 w-3.5", isHot ? "text-white" : "text-orange-500")} />
              <span>{temperature}°</span>
            </div>
          </div>

          {/* Discount Badge */}
          {discountPercent !== null && discountPercent > 0 && (
            <div className="absolute right-3 top-3 z-10">
              <span className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-md tracking-wider">
                -{discountPercent}%
              </span>
            </div>
          )}

          {/* Glass footer of shop info on image */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-between text-white">
            <span className="text-xs font-medium flex items-center gap-1">
              <Store className="h-3 w-3" />
              {source}
            </span>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h3 className="line-clamp-2 text-sm font-semibold leading-relaxed text-foreground group-hover:text-primary transition-colors duration-200">
              {title}
            </h3>
          </div>

          {/* Price & CTA Section */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-col">
              {price && (
                <span className="text-lg font-extrabold text-foreground tracking-tight">
                  {price}
                </span>
              )}
              {originalPrice && originalPrice !== price && (
                <span className="text-xs text-muted-foreground line-through opacity-70">
                  {originalPrice}
                </span>
              )}
            </div>

            {/* Glowing circle CTA button */}
            <div className="h-9 w-9 rounded-full bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground text-primary flex items-center justify-center transition-all duration-300 shadow-sm group-hover:shadow-md">
              <ArrowUpRight className="h-4 w-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
