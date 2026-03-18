'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Flame, Store, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { withImageProxy } from '@/lib/image-proxy';

interface HomeDealCardProps {
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

function formatPrice(value: any, fallbackCurrency = 'PLN'): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: fallbackCurrency }).format(value);
  }

  if (value && typeof value === 'object' && typeof value.amount === 'number') {
    const currency = typeof value.currency === 'string' && value.currency ? value.currency : fallbackCurrency;
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(value.amount);
  }

  return null;
}

export default function HomeDealCard({ deal, priority = false }: HomeDealCardProps) {
  const title = getLocalizedText(deal?.title, 'Oferta');
  const image = getDealImage(deal);
  const href = `/deals/${deal?.id}`;
  const source = getLocalizedText(deal?.merchant || deal?.metadata?.merchant || deal?.source, 'Oferta');
  const price = formatPrice(deal?.price ?? deal?.legacyPrice, deal?.currency || 'PLN');
  const originalPrice = typeof deal?.originalPrice === 'number'
    ? formatPrice(deal.originalPrice, deal?.currency || 'PLN')
    : null;
  const temperature = typeof deal?.temperature === 'number' ? Math.round(deal.temperature) : null;

  return (
    <Link href={href} className="block h-full">
      <Card className="h-full overflow-hidden border-border/60 transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <Image
            src={withImageProxy(image)}
            alt={title}
            fill
            sizes="(max-width: 640px) 92vw, (max-width: 1024px) 46vw, (max-width: 1536px) 30vw, 320px"
            className="object-cover"
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            quality={65}
          />
          <div className="absolute left-3 top-3 flex gap-2">
            {temperature !== null && (
              <Badge className="bg-background/95 text-foreground shadow-sm">
                <Flame className="mr-1 h-3 w-3 text-orange-500" />
                {temperature}
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="space-y-3 p-4">
          <h3 className="line-clamp-2 min-h-[3rem] text-sm font-semibold leading-6 text-foreground sm:text-base">
            {title}
          </h3>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              {price && <div className="text-lg font-bold text-primary">{price}</div>}
              {originalPrice && originalPrice !== price && (
                <div className="text-xs text-muted-foreground line-through">{originalPrice}</div>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Store className="h-3.5 w-3.5" />
              <span className="max-w-[7rem] truncate">{source}</span>
            </div>
          </div>

          {deal?.dealType && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3.5 w-3.5" />
              <span>{deal.dealType}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}