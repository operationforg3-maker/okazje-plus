
"use client";
import { ProductGallery } from './product-gallery';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Star, Tag, TrendingUp, ExternalLink, Heart, MessageSquare, Split, Truck, Package, Zap, AlertTriangle, ShieldCheck, Info, Scale, Share2 } from 'lucide-react';
import { useComparison } from './deal-comparison-tool';
import { RatingBar } from './rating-bar';
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
import { useEffect, useState } from 'react';
import { trackFirestoreView, trackFirestoreClick, trackFirestoreShare } from '@/lib/analytics';
import AdminEditButton from '@/components/admin/admin-edit-button';
import ProductEditDialog from '@/components/admin/product-edit-dialog';

interface ProductCardProps {
  product: Product;
}

const toPlainText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const firstText = value.find((entry) => typeof entry === 'string');
    return typeof firstText === 'string' ? firstText : '';
  }
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      if (typeof entry === 'string') return entry;
      if (typeof entry === 'number' || typeof entry === 'boolean') return String(entry);
    }
  }
  return '';
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace?.(/[^0-9.,-]/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

type NormalizedRatingSource = {
  average: number;
  count?: number;
  source?: string;
};

const normalizeRatingSource = (source: any): NormalizedRatingSource | null => {
  if (!source || typeof source !== 'object') return null;
  const average = toNumber(source.average);
  if (average === null) return null;
  const count = toNumber(source.count);
  const normalized: NormalizedRatingSource = { average };
  if (typeof count === 'number') normalized.count = Math.max(0, Math.round(count));
  const textSource = toPlainText(source.source);
  if (textSource) normalized.source = textSource;
  return normalized;
};

export default function ProductCard({ product }: ProductCardProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  const { isFavorited, isLoading, toggleFavorite } = useFavorites(product.id, 'product');
  const { user } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  // Usunięto wywołania useCoupons i useSkuDetail - dane powinny być już w Firestore
  // Usunięto skuOpen state - modal wariantów został usunięty
  
  const safePrice = typeof product.price === 'number' ? product.price : Number(product.price) || 0;
  const productName = toPlainText(product.name) || 'Produkt';
  const productDescription = toPlainText(product.description);
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(safePrice);
  const hasOriginal = typeof (product as any).originalPrice === 'number';
  const original = hasOriginal ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format((product as any).originalPrice) : null;
  const discount = hasOriginal && (product as any).originalPrice > 0
    ? Math.round(100 - (product.price / (product as any).originalPrice) * 100)
    : null;
  const rawCategoryBadge = product.subCategorySlug || product.mainCategorySlug || product.category;
  const categoryBadge = toPlainText(rawCategoryBadge);
  // Rozdzielone źródła ocen do RatingBar
  const users = normalizeRatingSource(product.ratingSources?.users);
  const editorial = normalizeRatingSource(product.ratingSources?.editorial);
  const external = normalizeRatingSource(product.ratingSources?.external);
  const liveComments = useCommentsCount('products', product.id, (product as any).commentsCount);
  const { addToComparison } = useComparison();
  const normalizedSpecifications = Array.isArray(product.metadata?.specifications)
    ? product.metadata.specifications
        .map((spec: any) => {
          if (!spec || typeof spec !== 'object') return null;
          const key = toPlainText(spec.key);
          const value = toPlainText(spec.value);
          if (!key || !value) return null;
          return { key, value };
        })
        .filter(Boolean) as { key: string; value: string }[]
    : [];
  const shippingLabel = toPlainText(product.metadata?.shipping);
  const warehouseLabel = toPlainText(product.metadata?.warehouse);
  const returnPolicyText = toPlainText(product.metadata?.returnPolicy);
  const galleryFromDoc = Array.isArray(product.gallery)
    ? product.gallery
        .map((img: any) => {
          if (!img) return null;
          if (typeof img === 'string') {
            return { src: img, alt: productName };
          }
          if (typeof img === 'object') {
            const src = typeof img.src === 'string' ? img.src : undefined;
            const alt = toPlainText(img.alt) || productName;
            return src ? { src, alt } : null;
          }
          return null;
        })
        .filter(Boolean) as { src: string; alt?: string }[]
    : [];
  const fallbackImage = typeof product.image === 'string' && product.image.length > 4
    ? product.image
    : '/placeholder.png';
  const galleryImages = galleryFromDoc.length > 0 ? galleryFromDoc : [{ src: fallbackImage, alt: productName }];

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
      href={`${prefix}/products/${product.id}`} 
      onClick={handleDetailClick}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-primary/50"
    >
      {/* Galeria zdjęć produktu */}
      <div className="relative overflow-hidden">
        <ProductGallery images={galleryImages} />
        {/* Pasek ocen - zawsze widoczny */}
        <div className="absolute left-1.5 top-1.5 z-10">
          <RatingBar users={users} editorial={editorial} external={external} />
        </div>
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
        
        {/* Admin Edit Button - prawy dolny róg obrazka */}
        <div className="absolute right-2 bottom-2">
          <AdminEditButton
            onClick={() => setEditDialogOpen(true)}
            className="h-8 w-8 rounded-full bg-white/90 shadow-md hover:bg-white"
            tooltip="Edytuj produkt (admin)"
          />
        </div>
      </div>
      
      {/* Edit Dialog */}
      <ProductEditDialog
        product={product}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
      
      <div className="flex-grow space-y-3 p-4">
        <div className="flex items-center justify-between">
          {categoryBadge && (
            <Badge variant="secondary" className="flex w-fit items-center gap-1">
              <Tag className="h-3 w-3" aria-hidden />
              {categoryBadge}
            </Badge>
          )}
          {/* Usunięto badge kuponów - dane powinny być w product.metadata */}
          {/* Usunięto badge czasu dostawy z live API - dane powinny być w Firestore */}
          {product.metadata?.freeShipping && (
            <Badge variant="default" className="flex w-fit items-center gap-1 bg-green-600">
              Darmowa dostawa
            </Badge>
          )}
          {product.metadata?.hotProduct && (
            <Badge variant="destructive" className="flex w-fit items-center gap-1 bg-red-600 animate-pulse">
              <Zap className="h-3 w-3" aria-hidden />
              HOT
            </Badge>
          )}
          {product.metadata?.flashDeal && (
            <Badge variant="destructive" className="flex w-fit items-center gap-1 bg-orange-600">
              <Zap className="h-3 w-3" aria-hidden />
              Flash Deal
            </Badge>
          )}
          {product.metadata?.stockStatus === 'low_stock' && (
            <Badge variant="outline" className="flex w-fit items-center gap-1 border-yellow-600 text-yellow-600">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Niski stan
            </Badge>
          )}
          {product.metadata?.stockStatus === 'out_of_stock' && (
            <Badge variant="outline" className="flex w-fit items-center gap-1 border-red-600 text-red-600">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Wyprzedane
            </Badge>
          )}
          {product.metadata?.promotionId && (
            <Badge variant="secondary" className="flex w-fit items-center gap-1 bg-purple-600 text-white">
              <Tag className="h-3 w-3" aria-hidden />
              Promocja
            </Badge>
          )}
        </div>

        <h3 className="font-headline text-lg font-semibold leading-tight transition-colors group-hover:text-primary">
          {productName}
        </h3>
        
        <p className="text-sm text-muted-foreground line-clamp-2">
          {productDescription}
        </p>

        {product.ai?.enrichment?.features && product.ai.enrichment.features.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
            {product.ai.enrichment.features.slice(0,3).map((f, idx) => (
              <li key={idx} className="leading-snug">{typeof f === 'string' ? f : ''}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <p className="text-xl font-bold text-primary">{price}</p>
          {original && (
            <p className="text-sm text-muted-foreground line-through">{original}</p>
          )}
          {typeof discount === 'number' && discount > 0 && (
            <Badge variant="destructive" className="ml-auto">-{discount}%</Badge>
          )}
        </div>
        {/* Parametry i wysyłka */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {shippingLabel && (
            <span>Dostawa: {shippingLabel}</span>
          )}
          {warehouseLabel && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              Magazyn: {warehouseLabel}
            </span>
          )}
          {typeof product.metadata?.shippingCost === 'number' && product.metadata.shippingCost > 0 && (
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Wysyłka: {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.metadata.shippingCost)}
            </span>
          )}
          {typeof product.metadata?.orders === 'number' && (
            <span>Zamówienia: {product.metadata.orders}</span>
          )}
          {typeof product.metadata?.sellerRating === 'number' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    Sprzedawca: {product.metadata.sellerRating.toFixed(1)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Ocena sprzedawcy na platformie
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {returnPolicyText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help text-green-600">
                    <ShieldCheck className="h-3 w-3" />
                    Zwroty
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {returnPolicyText}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {normalizedSpecifications.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help">
                    <Info className="h-3 w-3" />
                    Specyfikacja
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1">
                    {normalizedSpecifications.slice(0, 5).map((spec, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-semibold">{spec.key}:</span> {spec.value}
                      </div>
                    ))}
                    {normalizedSpecifications.length > 5 && (
                      <div className="text-[11px] opacity-70">+{normalizedSpecifications.length - 5} więcej</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {typeof product.metadata?.evaluateCount === 'number' && product.metadata.evaluateCount > 0 && (
            <span>Oceny: {product.metadata.evaluateCount}</span>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between gap-2 border-t bg-muted/30 p-3">
        <ShareButton 
          type="product"
          itemId={product.id}
          title={productName}
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
          {typeof product.shareCount === 'number' && product.shareCount > 0 && (
            <div className="flex items-center gap-1" title="Udostępnienia">
              <Share2 className="h-4 w-4" />
              <span>{product.shareCount}</span>
            </div>
          )}
        </div>
        <Button 
          size="sm" 
          className="gap-1 flex-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = typeof product.affiliateUrl === 'string' ? product.affiliateUrl : '#';
            window.open(url, '_blank', 'noopener,noreferrer');
            handleAffiliateClick();
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Kup teraz
        </Button>
        {/* Usunięto przycisk wariantów - dane powinny być w Firestore, nie z live API */}
        {/* Usunięto wyświetlanie kuponów i wariantów z live API - dane powinny być w Firestore */}
      </div>
    </Link>
  );
}
