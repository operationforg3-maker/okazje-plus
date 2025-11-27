
"use client";
import { ProductGallery } from './product-gallery';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Star, Tag, TrendingUp, ExternalLink, Heart, MessageSquare, Split, Truck, Package, Zap, AlertTriangle, ShieldCheck, Info, Scale, Share2 } from 'lucide-react';
import { useComparison } from './deal-comparison-tool';
import { RatingBar } from './rating-bar';
import { useCommentsCount } from '@/hooks/use-comments-count';
import { useCoupons } from '@/hooks/use-coupons';
import { useSkuDetail } from '@/hooks/use-sku-detail';
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

export default function ProductCard({ product }: ProductCardProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  const { isFavorited, isLoading, toggleFavorite } = useFavorites(product.id, 'product');
  const { user } = useAuth();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { coupons } = useCoupons(product.metadata?.originalId || product.id, undefined);
  const { detail } = useSkuDetail(product.metadata?.originalId || product.id);
  const [skuOpen, setSkuOpen] = useState(false);
  
  const price = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(product.price);
  const hasOriginal = typeof (product as any).originalPrice === 'number';
  const original = hasOriginal ? new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format((product as any).originalPrice) : null;
  const discount = hasOriginal && (product as any).originalPrice > 0
    ? Math.round(100 - (product.price / (product as any).originalPrice) * 100)
    : null;
  const categoryBadge = product.subCategorySlug || product.mainCategorySlug || product.category;
  // Rozdzielone źródła ocen do RatingBar
  const users = product.ratingSources?.users;
  const editorial = product.ratingSources?.editorial;
  const external = product.ratingSources?.external;
  const liveComments = useCommentsCount('products', product.id, (product as any).commentsCount);
  const { addToComparison } = useComparison();

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
      <ProductGallery images={product.gallery ? product.gallery.map(img => ({ src: img.src, alt: img.alt })) : [{ src: product.image, alt: product.name }]} />
      <div className="relative overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          data-ai-hint={product.imageHint}
          width={600}
          height={400}
          className="aspect-[3/2] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
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
          {Array.isArray(coupons) && coupons.length > 0 && (
            <Badge variant="default" className="flex w-fit items-center gap-1">
              <Tag className="h-3 w-3" aria-hidden />
              Kupon
              <span className="ml-1 text-[11px] opacity-80">{coupons.length}</span>
            </Badge>
          )}
          {detail?.shipping?.deliveryTime && (
            <Badge variant="outline" className="flex w-fit items-center gap-1">
              Dostawa: {detail.shipping.deliveryTime}
            </Badge>
          )}
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
          {product.name}
        </h3>
        
        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>

        {product.ai?.enrichment?.features && product.ai.enrichment.features.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
            {product.ai.enrichment.features.slice(0,3).map((f, idx) => (
              <li key={idx} className="leading-snug">{f}</li>
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
          {typeof product.metadata?.shipping === 'string' && (
            <span>Dostawa: {product.metadata.shipping}</span>
          )}
          {typeof product.metadata?.warehouse === 'string' && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              Magazyn: {product.metadata.warehouse}
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
          {product.metadata?.returnPolicy && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help text-green-600">
                    <ShieldCheck className="h-3 w-3" />
                    Zwroty
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {product.metadata.returnPolicy}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {product.metadata?.specifications && Array.isArray(product.metadata.specifications) && product.metadata.specifications.length > 0 && (
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
                    {product.metadata.specifications.slice(0, 5).map((spec, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-semibold">{spec.key}:</span> {spec.value}
                      </div>
                    ))}
                    {product.metadata.specifications.length > 5 && (
                      <div className="text-[11px] opacity-70">+{product.metadata.specifications.length - 5} więcej</div>
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
            window.open(product.affiliateUrl, '_blank', 'noopener,noreferrer');
            handleAffiliateClick();
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Kup teraz
        </Button>
        {detail?.variants && detail.variants.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1" onClick={(e) => {
            e.preventDefault(); e.stopPropagation(); setSkuOpen(true);
          }}>
            <Split className="h-3.5 w-3.5" />
            Warianty
          </Button>
        )}
        {Array.isArray(coupons) && coupons.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  Kupony
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  {coupons.slice(0,3).map((c, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="font-semibold">{c.coupon_code || 'Kupon'}: {c.coupon_amount || ''}</div>
                      {c.coupon_start_time && c.coupon_end_time && (
                        <div className="text-[10px] opacity-70">Ważny: {new Date(c.coupon_start_time).toLocaleDateString('pl')} - {new Date(c.coupon_end_time).toLocaleDateString('pl')}</div>
                      )}
                    </div>
                  ))}
                  {coupons.length > 3 && (
                    <div className="text-[11px] opacity-70">+{coupons.length - 3} więcej</div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Modal wariantów */}
      {skuOpen && detail?.variants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSkuOpen(false)}>
          <div className="mx-4 w-full max-w-lg rounded-lg bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold">Warianty produktu</h4>
              <Button variant="ghost" size="sm" onClick={() => setSkuOpen(false)}>Zamknij</Button>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-auto">
              {detail.variants.map((v, i) => (
                <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div className="truncate pr-2">{v.sku_property || 'Wariant'} {v.sku_id ? `(#${v.sku_id})` : ''}</div>
                  <div className="opacity-80">{v.sku_price || ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}
