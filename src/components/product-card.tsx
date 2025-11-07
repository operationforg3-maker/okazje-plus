import Image from 'next/image';
import Link from 'next/link';
import { Star, Tag } from 'lucide-react';
import type { Product } from '@/lib/types';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.price);
  const hasOriginal = typeof (product as any).originalPrice === 'number';
  const original = hasOriginal ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format((product as any).originalPrice) : null;
  const discount = hasOriginal && (product as any).originalPrice > 0
    ? Math.round(100 - (product.price / (product as any).originalPrice) * 100)
    : null;
  const categoryBadge = product.subCategorySlug || product.mainCategorySlug || product.category;
  return (
    <Card className="flex h-full flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      <CardHeader className="p-0">
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
      </CardHeader>
      <CardContent className="flex-grow p-4">
        {categoryBadge && (
          <Badge variant="secondary" className="mb-2 flex w-fit items-center gap-1">
            <Tag className="h-3 w-3" aria-hidden />
            {categoryBadge}
          </Badge>
        )}
        <Link href={`/products/${product.id}`}>
          <h3 className="font-headline text-lg font-semibold leading-tight hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-xl font-bold text-primary">{price}</p>
          {original && (
            <p className="text-sm text-muted-foreground line-through">{original}</p>
          )}
          {typeof discount === 'number' && discount > 0 && (
            <Badge variant="destructive" className="ml-auto">-{discount}%</Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4 pt-0">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground" aria-label="Oceny produktu">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" aria-label="Trwałość" />
            <span>Trwałość: {product.ratingCard.durability.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" aria-label="Jakość do ceny" />
            <span>Jakość/Cena: {product.ratingCard.valueForMoney.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" aria-label="Łatwość użycia" />
            <span>Łatwość Użycia: {product.ratingCard.easeOfUse.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" aria-label="Wszechstronność" />
            <span>Wszechstronność: {product.ratingCard.versatility.toFixed(1)}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
