"use client";

import { Deal, Product } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface AttachmentCardProps {
  item: Deal | Product;
  type: 'deal' | 'product';
  variant?: 'full' | 'compact';
}

export function AttachmentCard({ item, type, variant = 'full' }: AttachmentCardProps) {
  const title = type === 'deal' ? (item as Deal).title : (item as Product).name;
  const image = item.image;
  const price = type === 'deal' ? (item as Deal).price : (item as Product).price;
  const temperature = type === 'deal' ? (item as Deal).temperature : undefined;
  const url = type === 'deal' ? `/deals/${item.id}` : `/products/${item.id}`;
  const merchant = type === 'deal' ? (item as Deal).merchant : undefined;

  if (variant === 'compact') {
    return (
      <Link href={url} className="block">
        <Card className="p-2 flex items-center gap-2 hover:bg-muted/50 transition-colors">
          <img src={image} alt={title} className="w-12 h-12 object-cover rounded" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium line-clamp-1">{title}</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{price} zł</Badge>
              {temperature !== undefined && <Badge variant="secondary" className="text-xs">{temperature}°</Badge>}
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </Card>
      </Link>
    );
  }

  return (
    <Link href={url} className="block">
      <Card className="p-4 hover:bg-muted/50 transition-colors">
        <div className="flex gap-4">
          <img src={image} alt={title} className="w-24 h-24 object-cover rounded" />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold line-clamp-2">{title}</h3>
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge className="text-base font-bold">{price} zł</Badge>
              {temperature !== undefined && <Badge variant="secondary">{temperature}°</Badge>}
              <Badge variant="outline">{type === 'deal' ? 'Okazja' : 'Produkt'}</Badge>
            </div>
            {merchant && (
              <div className="mt-2 text-sm text-muted-foreground">
                Sklep: {merchant}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
