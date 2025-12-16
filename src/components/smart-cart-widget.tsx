/**
 * Smart Cart UI Component (M4)
 * 
 * Displays user's shopping cart with:
 * ✅ Product list with images and prices
 * ✅ Quantity controls
 * ✅ Total landed cost (product + shipping)
 * ✅ "Finalize Purchase" button to generate affiliate links
 * ✅ Price change alerts
 * ✅ Free shipping badges
 */

'use client';

import { useSmartCart } from '@/lib/cart-context';
import { useContentLanguage } from '@/hooks/use-content-language';
import { getPriceAmount, getTotalPrice, formatPrice, isFreeShipping } from '@/lib/i18n-utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Minus, ShoppingCart, ExternalLink, Share2, Copy, Check, Mail } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function SmartCartWidget() {
  const { items, itemCount, totalAmount, totalWithShipping, removeItem, updateQuantity, clearCart, finalizeCart, shareCart } = useSmartCart();
  const { getText } = useContentLanguage();
  
  // Batch finalize state
  const [finalizeState, setFinalizeState] = useState({
    isFinalizing: false,
    generatedLinks: [] as Array<{ product: any; affiliateLink: string }>,
  });

  // Batch share dialog state
  const [shareDialogState, setShareDialogState] = useState({
    isShareDialogOpen: false,
    isSharing: false,
    shareUrl: null as string | null,
    copied: false,
  });

  const handleFinalize = async () => {
    setFinalizeState(prev => ({ ...prev, isFinalizing: true }));
    try {
      const result = await finalizeCart();
      setFinalizeState(prev => ({ ...prev, generatedLinks: result.links }));
      
      // Open links in new tabs
      result.links.forEach(({ affiliateLink }) => {
        window.open(affiliateLink, '_blank');
      });
    } catch (error) {
      console.error('Failed to finalize cart', error);
    } finally {
      setFinalizeState(prev => ({ ...prev, isFinalizing: false }));
    }
  };

  // Generate share link when dialog opens
  useEffect(() => {
    // Guard: only run in browser with valid state
    if (typeof window === 'undefined') return;
    if (!shareDialogState.isShareDialogOpen || shareDialogState.shareUrl || shareDialogState.isSharing) return;
    
    let cancelled = false;
    
    const generateShareLink = async () => {
      if (cancelled) return;
      
      setShareDialogState(prev => ({ ...prev, isSharing: true, copied: false }));
      
      try {
        const result = await shareCart();
        if (cancelled) return;
        
        if (result) {
          setShareDialogState(prev => ({ ...prev, shareUrl: result.shareUrl }));
          toast.success('Lista została udostępniona!', {
            description: 'Link został wygenerowany i jest gotowy do skopiowania.',
          });
        } else {
          toast.error('Nie udało się udostępnić listy', {
            description: 'Spróbuj ponownie lub skontaktuj się z pomocą techniczną.',
          });
          setShareDialogState(prev => ({ ...prev, isShareDialogOpen: false }));
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to share cart', error);
        toast.error('Wystąpił błąd podczas udostępniania', {
          description: 'Sprawdź połączenie internetowe i spróbuj ponownie.',
        });
        setShareDialogState(prev => ({ ...prev, isShareDialogOpen: false }));
      } finally {
        if (!cancelled) {
          setShareDialogState(prev => ({ ...prev, isSharing: false }));
        }
      }
    };
    
    generateShareLink();
    
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareDialogState.isShareDialogOpen, shareDialogState.shareUrl, shareDialogState.isSharing]);
  
  // Reset state when dialog closes
  useEffect(() => {
    if (!shareDialogState.isShareDialogOpen) {
      setShareDialogState(prev => ({ ...prev, shareUrl: null, copied: false }));
    }
  }, [shareDialogState.isShareDialogOpen]);

  const handleCopyLink = async () => {
    if (!shareDialogState.shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareDialogState.shareUrl);
      setShareDialogState(prev => ({ ...prev, copied: true }));
      toast.success('Link skopiowany!', {
        description: 'Link do listy został skopiowany do schowka.',
      });
      setTimeout(() => setShareDialogState(prev => ({ ...prev, copied: false })), 2000);
    } catch (error) {
      console.error('Failed to copy link', error);
      toast.error('Nie udało się skopiować linku', {
        description: 'Spróbuj skopiować link ręcznie.',
      });
    }
  };

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Twoja lista zakupowa jest pusta</h3>
        <p className="text-sm text-muted-foreground">
          Dodaj produkty do listy, aby przejść do zakupu z najlepszymi cenami!
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cart Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Twoja Lista Zakupowa</h2>
          <p className="text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? 'produkt' : 'produktów'} w liście
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={clearCart}>
          Wyczyść listę
        </Button>
      </div>

      {/* Cart Items */}
      <div className="space-y-4">
        {items.map(item => {
          const price = getPriceAmount(item.product.price);
          const totalPrice = getTotalPrice(item.product.price);
          const freeShipping = isFreeShipping(item.product.price);
          // Backward compatibility: old products have 'name' (string), new have 'title' (LocalizedText)
          const title = item.product.title ? getText(item.product.title) : (item.product.name || 'Produkt');

          return (
            <Card key={item.product.id} className="p-4">
              <div className="flex gap-4">
                {/* Product Image */}
                <div className="relative h-20 w-20 flex-shrink-0">
                  <Image
                    src={item.product.image}
                    alt={title}
                    fill
                    className="object-cover rounded"
                  />
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{title}</h3>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-bold">
                      {formatPrice(price)}
                    </span>
                    
                    {freeShipping && (
                      <Badge variant="secondary" className="text-xs">
                        Darmowa wysyłka
                      </Badge>
                    )}
                  </div>

                  {!freeShipping && (
                    <p className="text-sm text-muted-foreground mt-1">
                      + wysyłka: {formatPrice(totalPrice - price)}
                    </p>
                  )}

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    
                    <span className="font-medium w-8 text-center">{item.quantity}</span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.product.id)}
                      className="ml-auto text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Cart Summary */}
      <Card className="p-6 bg-muted/50">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Suma produktów:</span>
            <span className="font-medium">{Number.isFinite(totalAmount) ? totalAmount.toFixed(2) : '—'} PLN</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Wysyłka:</span>
            <span className="font-medium">
              {Number.isFinite(totalWithShipping - totalAmount) ? (totalWithShipping - totalAmount).toFixed(2) : '—'} PLN
            </span>
          </div>
          
          <div className="border-t pt-3 flex justify-between">
            <span className="font-semibold text-lg">Razem do zapłaty:</span>
            <span className="font-bold text-xl text-primary">
              {Number.isFinite(totalWithShipping) ? totalWithShipping.toFixed(2) : '—'} PLN
            </span>
          </div>
        </div>

        <div className="space-y-3 mt-6">
          <Button
            className="w-full"
            size="lg"
            onClick={handleFinalize}
            disabled={finalizeState.isFinalizing}
          >
            {finalizeState.isFinalizing ? (
              'Generuję linki...'
            ) : (
              <>
                <ExternalLink className="mr-2 h-5 w-5" />
                Przejdź do zakupów ({itemCount})
              </>
            )}
          </Button>

          <Dialog open={shareDialogState.isShareDialogOpen} onOpenChange={(open) => setShareDialogState(prev => ({ ...prev, isShareDialogOpen: open }))}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Share2 className="mr-2 h-5 w-5" />
                Udostępnij listę
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Udostępnij swoją listę zakupową</DialogTitle>
                <DialogDescription>
                  Skopiuj link i prześlij znajomym. Lista będzie dostępna przez 30 dni.
                </DialogDescription>
              </DialogHeader>
              {shareDialogState.shareUrl ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Input
                      readOnly
                      value={shareDialogState.shareUrl ?? ''}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyLink}
                    >
                      {shareDialogState.copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        if (shareDialogState.shareUrl) {
                          window.open(shareDialogState.shareUrl, '_blank');
                        }
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Otwórz udostępnioną listę
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        if (shareDialogState.shareUrl) {
                          window.location.href = `mailto:?subject=Sprawdź moją listę zakupową&body=Cześć! Sprawdź moją listę zakupową: ${encodeURIComponent(shareDialogState.shareUrl)}`;
                        }
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Wyślij przez email
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Generowanie linku...
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-3">
          Klikając przejdziesz do AliExpress, gdzie sfinalizujesz zakupy z najlepszymi cenami
        </p>
      </Card>

      {/* Generated Links (after finalization) */}
      {finalizeState.generatedLinks.length > 0 && (
        <Card className="p-6 border-primary">
          <h3 className="font-semibold mb-3">✅ Linki zostały wygenerowane!</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Otworzyliśmy karty z produktami. Kliknij ponownie, aby otworzyć linki:
          </p>
          <div className="space-y-2">
            {finalizeState.generatedLinks.map(({ product, affiliateLink }) => (
              <Button
                key={product.id}
                variant="outline"
                size="sm"
                className="w-full justify-between"
                asChild
              >
                <a href={affiliateLink} target="_blank" rel="noopener noreferrer">
                  <span className="truncate">{product.title ? getText(product.title) : (product.name || 'Produkt')}</span>
                  <ExternalLink className="ml-2 h-4 w-4 flex-shrink-0" />
                </a>
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Mini Cart Badge (for Navbar)
 */
export function MiniCartBadge() {
  const { itemCount } = useSmartCart();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || itemCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
      {itemCount}
    </span>
  );
}
