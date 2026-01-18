"use client";

/**
 * ========================================
 * SMART CART PAGE — Koszyk Zakupowy
 * ========================================
 * 
 * Full-page cart view with:
 * ✅ Product list with quantity controls
 * ✅ Total landed cost calculation (item + shipping)
 * ✅ Finalize button → generate affiliate links
 * ✅ Empty state with CTA
 * ✅ Persistence (localStorage + Firestore)
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSmartCart } from '@/lib/cart-context';
import { useContentLanguage } from '@/hooks/use-content-language';
import { getTotalPrice, formatPrice } from '@/lib/i18n-utils';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ExternalLink,
  ShoppingBag,
  Truck,
  ArrowRight,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { Product } from '@/lib/types';

export default function CartPage() {
  const params = useParams();
  const t = useTranslations('cart');
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  const router = useRouter();
  const { getText } = useContentLanguage();
  const { 
    items, 
    itemCount, 
    totalAmount, 
    totalWithShipping, 
    removeItem, 
    updateQuantity, 
    clearCart, 
    finalizeCart,
    isLoading 
  } = useSmartCart();

  const [isFinalizing, setIsFinalizing] = useState(false);

  const handleFinalize = async () => {
    if (items.length === 0) return;

    setIsFinalizing(true);
    try {
      const { links } = await finalizeCart();
      
      // Open all affiliate links in new tabs
      links.forEach(({ affiliateLink }) => {
        window.open(affiliateLink, '_blank', 'noopener,noreferrer');
      });

      toast.success(`Otwarto ${links.length} linków afiliacyjnych!`, {
        description: 'Sprawdź nowe karty w przeglądarce aby dokończyć zakupy.',
      });

      // Clear cart after finalize
      setTimeout(() => {
        clearCart();
        router.push(`${prefix}/`);
      }, 2000);
    } catch (error) {
      console.error('Failed to finalize cart:', error);
      toast.error('Nie udało się wygenerować linków', {
        description: 'Spróbuj ponownie za moment.',
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-container py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  // Empty State
  if (items.length === 0) {
    return (
      <div className="page-container py-12">
        <Card className="max-w-2xl mx-auto text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <ShoppingBag className="w-16 h-16 text-gray-300" />
            </div>
            <CardTitle className="text-2xl">{t('empty.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t('empty.description')}
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link href={`${prefix}/products`}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {t('empty.cta')}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`${prefix}/deals`}>
                  Przeglądaj Okazje
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container py-8 lg:py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShoppingCart className="w-8 h-8" />
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {itemCount} {itemCount === 1 ? 'produkt' : 'produkty'} w koszyku
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={clearCart}>
          <Trash2 className="w-4 h-4 mr-2" />
          Wyczyść koszyk
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(({ product, deal, quantity, addedAt }) => {
            // Support both Product and Deal items
            const item = product || deal;
            if (!item) return null;
            
            const displayTitle = getText((item as any).title) || (item as any).name || 'Produkt';
            const itemPrice = getTotalPrice((item as any).price);
            const itemTotal = itemPrice * quantity;
            const currency = typeof (item as any).price === 'object' && 'currency' in (item as any).price 
              ? (item as any).price.currency 
              : 'PLN';
            const itemId = (item as any).id;
            const itemImage = (item as any).image || (item as any).imageUrl || '/placeholder.png';
            const itemSlug = (item as any).slug || itemId;
            const categorySlug = (item as any).mainCategorySlug || 'inne';

            return (
              <Card key={itemId}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={itemImage}
                        alt={displayTitle}
                        fill
                        sizes="96px"
                        className="object-contain p-2"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <Link 
                        href={product ? `${prefix}/products/${itemSlug}` : `${prefix}/deals/${itemSlug}`}
                        className="font-semibold text-base hover:text-primary transition-colors line-clamp-2"
                      >
                        {displayTitle}
                      </Link>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {categorySlug}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Dodano: {new Date(addedAt).toLocaleDateString('pl-PL', { timeZone: 'UTC' })}
                        </span>
                      </div>

                      {/* Price per item */}
                      <div className="mt-3">
                        <span className="text-lg font-bold">
                          {formatPrice(itemPrice, currency)}
                        </span>
                        <span className="text-sm text-muted-foreground ml-2">
                          za sztukę (z dostawą)
                        </span>
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-2 border rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(itemId, Math.max(1, quantity - 1))}
                          disabled={quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            updateQuantity(itemId, Math.max(1, Math.min(99, val)));
                          }}
                          className="w-16 h-8 text-center border-0 p-0"
                          min={1}
                          max={99}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(itemId, Math.min(99, quantity + 1))}
                          disabled={quantity >= 99}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Item Total */}
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          {formatPrice(itemTotal, currency)}
                        </div>
                        {quantity > 1 && (
                          <div className="text-xs text-muted-foreground">
                            ({quantity} × {formatPrice(itemPrice, currency)})
                          </div>
                        )}
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeItem(itemId);
                          toast.success(t('toast.removed'));
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {t('item.remove')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>{t('summary.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Items count */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Liczba produktów:</span>
                <span className="font-medium">{itemCount}</span>
              </div>

              {/* Subtotal (items only) */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Suma produktów:</span>
                <span className="font-medium">{formatPrice(totalAmount, 'PLN')}</span>
              </div>

              {/* Shipping */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Truck className="w-4 h-4" />
                  Dostawa:
                </span>
                <span className="font-medium">
                  {totalWithShipping - totalAmount > 0 
                    ? formatPrice(totalWithShipping - totalAmount, 'PLN')
                    : 'Gratis!'}
                </span>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between text-lg font-bold">
                <span>Razem:</span>
                <span className="text-primary">{formatPrice(totalWithShipping, 'PLN')}</span>
              </div>

              {/* Info box */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Po kliknięciu "Przejdź do zakupów" wygenerujemy linki do sklepów. 
                    Każdy link otworzy się w nowej karcie przeglądarki.
                  </p>
                </div>
              </div>

            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button
                size="lg"
                className="w-full"
                onClick={handleFinalize}
                disabled={isFinalizing}
              >
                {isFinalizing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Generowanie linków...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5 mr-2" />
                    {t('summary.finalize')}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                asChild
              >
                <Link href={`${prefix}/products`}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kontynuuj zakupy
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
