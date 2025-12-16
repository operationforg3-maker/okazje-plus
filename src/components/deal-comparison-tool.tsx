// @ts-nocheck
"use client";

import { useState, useEffect } from 'react';
import { Deal, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Scale, X, ExternalLink, Check, Flame, Star, ShoppingCart, TrendingDown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSmartCart } from '@/lib/cart-context';

type ComparisonItem = (Deal | Product) & { type: 'deal' | 'product' };

const MAX_COMPARISON_ITEMS = 4;

export function DealComparisonTool() {
  const [comparisonState, setComparisonState] = useState({
    items: [] as ComparisonItem[],
    isOpen: false,
    isMounted: false
  });
  const { addItem: addToCart, isInCart } = useSmartCart();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('comparisonItems');
      let loadedItems: ComparisonItem[] = [];
      
      if (stored) {
        try {
          loadedItems = JSON.parse(stored);
        } catch (error) {
          console.error('Error parsing comparison items:', error);
          localStorage.removeItem('comparisonItems');
        }
      }
      
      // SINGLE setState
      setComparisonState(prev => ({
        ...prev,
        isMounted: true,
        items: loadedItems
      }));
    }
  }, []);

  useEffect(() => {
    // Save to localStorage only on client
    if (typeof window !== 'undefined' && comparisonState.isMounted) {
      localStorage.setItem('comparisonItems', JSON.stringify(comparisonState.items));
    }
  }, [comparisonState.items, comparisonState.isMounted]);

  const addItem = (item: ComparisonItem) => {
    if (comparisonState.items.length >= MAX_COMPARISON_ITEMS) {
      toast.error(`Możesz porównać maksymalnie ${MAX_COMPARISON_ITEMS} elementy`);
      return;
    }

    if (comparisonState.items.some(i => i.id === item.id)) {
      toast.error('Ten element jest już w porównaniu');
      return;
    }

    setComparisonState(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));
    toast.success('Dodano do porównania', {
      action: {
        label: 'Pokaż',
        onClick: () => setComparisonState(prev => ({ ...prev, isOpen: true })),
      },
    });
  };

  const removeItem = (itemId: string) => {
    setComparisonState(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId)
    }));
    toast.success('Usunięto z porównania');
  };

  const clearAll = () => {
    setComparisonState(prev => ({
      ...prev,
      items: []
    }));
    toast.success('Wyczyszczono porównanie');
  };

  const getPrice = (item: ComparisonItem): number => {
    if (item.type === 'deal') {
      return (item as Deal).price || 0;
    }
    return (item as Product).price || 0;
  };

  const getTemperature = (item: ComparisonItem): number => {
    if (item.type === 'deal') {
      return (item as Deal).temperature || 0;
    }
    return 0;
  };

  const getShipping = (item: ComparisonItem): string => {
    if (item.type === 'deal') {
      const deal = item as Deal;
      return deal.freeShipping ? 'Darmowa' : deal.shippingCost ? `${deal.shippingCost} zł` : 'Nieznana';
    }
    return 'N/A';
  };

  const getStore = (item: ComparisonItem): string => {
    if (item.type === 'deal') {
      const deal = item as Deal;
      return deal.merchant || 'Nieznany';
    }
    return 'N/A';
  };

  const getTitle = (item: ComparisonItem): string => {
    if (item.type === 'deal') {
      return (item as Deal).title;
    }
    return (item as Product).name;
  };

  if (!comparisonState.isMounted) {
    return null;
  }

  // Smart cart features
  const [isExpanded, setIsExpanded] = useState(false);
  const totalValue = comparisonState.items.reduce((sum, item) => sum + getPrice(item), 0);
  const avgPrice = comparisonState.items.length > 0 ? totalValue / comparisonState.items.length : 0;
  const lowestPrice = comparisonState.items.length > 0 ? Math.min(...comparisonState.items.map(getPrice)) : 0;
  const bestDeal = comparisonState.items.find(item => getPrice(item) === lowestPrice);

  return (
    <>
      {/* Floating Smart Cart - lewitujący przycisk z mini-podglądem */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Expanded mini-preview */}
        {isExpanded && comparisonState.items.length > 0 && (
          <div className="absolute bottom-20 right-0 w-80 bg-card border border-border rounded-lg shadow-2xl mb-2 overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="p-4 bg-muted/50 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Porównujesz {comparisonState.items.length} {comparisonState.items.length === 1 ? 'produkt' : 'produkty'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Smart insights */}
            <div className="p-3 bg-primary/5 border-b text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Łączna wartość:</span>
                <span className="font-bold">{totalValue.toFixed(2)} zł</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Średnia cena:</span>
                <span className="font-semibold">{avgPrice.toFixed(2)} zł</span>
              </div>
              {bestDeal && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>🏆 Najlepsza oferta:</span>
                  <span className="font-bold">{lowestPrice.toFixed(2)} zł</span>
                </div>
              )}
            </div>

            {/* Mini product cards */}
            <div className="max-h-64 overflow-y-auto">
              {comparisonState.items.map((item) => {
                const price = getPrice(item);
                const isBest = price === lowestPrice;
                return (
                  <div
                    key={item.id}
                    className={`p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors ${
                      isBest ? 'bg-green-50 dark:bg-green-950/20' : ''
                    }`}
                  >
                    <div className="flex gap-2">
                      <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-muted">
                        {(item as any).image && (
                          <img
                            src={(item as any).image}
                            alt={getTitle(item)}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1 mb-1">
                          <p className="text-xs font-medium line-clamp-2 leading-tight flex-1">
                            {getTitle(item)}
                          </p>
                          {isBest && (
                            <Badge variant="default" className="text-[10px] px-1 py-0 h-4 bg-green-600">
                              TOP
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isBest ? 'text-green-600 dark:text-green-400' : ''}`}>
                              {price.toFixed(2)} zł
                            </span>
                            {item.type === 'product' && isInCart((item as Product).id) && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                W koszyku
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => removeItem(item.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Smart Actions */}
            <div className="p-3 bg-muted/30 space-y-2">
              {/* Add best deal to cart */}
              {bestDeal && (
                <Button
                  className="w-full gap-2"
                  size="sm"
                  variant="default"
                  onClick={() => {
                    if (bestDeal.type === 'product') {
                      addToCart(bestDeal as Product);
                      toast.success('Najlepszą ofertę dodano do koszyka! 🏆');
                    }
                  }}
                  disabled={bestDeal.type !== 'product'}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Dodaj najlepszą do koszyka
                </Button>
              )}
              
              {/* Add all to cart */}
              <Button
                variant="outline"
                className="w-full gap-2"
                size="sm"
                onClick={() => {
                  let added = 0;
                  comparisonState.items.forEach(item => {
                    if (item.type === 'product' && !isInCart((item as Product).id)) {
                      addToCart(item as Product);
                      added++;
                    }
                  });
                  if (added > 0) {
                    toast.success(`Dodano ${added} produktów do koszyka`);
                  }
                }}
              >
                <ShoppingCart className="h-4 w-4" />
                Dodaj wszystkie do koszyka
              </Button>
              
              <Button
                variant="outline"
                className="w-full gap-2"
                size="sm"
                onClick={() => {
                  setComparisonState(prev => ({ ...prev, isOpen: true }));
                  setIsExpanded(false);
                }}
              >
                <Scale className="h-4 w-4" />
                Pełne porównanie
              </Button>
              
              <Button
                variant="ghost"
                className="w-full"
                size="sm"
                onClick={clearAll}
              >
                <X className="h-4 w-4 mr-2" />
                Wyczyść
              </Button>
            </div>
          </div>
        )}

        {/* Main floating button */}
        <Sheet open={comparisonState.isOpen} onOpenChange={(open) => setComparisonState(prev => ({ ...prev, isOpen: open }))}>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="rounded-full shadow-2xl gap-2 relative group hover:scale-105 transition-transform"
              disabled={comparisonState.items.length === 0}
              variant={comparisonState.items.length === 0 ? 'outline' : 'default'}
              onClick={(e) => {
                if (comparisonState.items.length > 0 && !comparisonState.isOpen) {
                  // On first click, expand preview instead of opening sheet
                  e.preventDefault();
                  setIsExpanded(!isExpanded);
                }
              }}
            >
              <Scale className="h-5 w-5" />
              Porównaj
              {comparisonState.items.length > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 rounded-full bg-primary text-primary-foreground"
                >
                  {comparisonState.items.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Porównanie {comparisonState.items.length === 1 ? 'elementu' : 'elementów'}
                </span>
                {comparisonState.items.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearAll}>
                    Wyczyść wszystko
                  </Button>
                )}
              </SheetTitle>
              <SheetDescription>
                {comparisonState.items.length === 0 
                  ? 'Kliknij przycisk "Porównaj" (ikona wagi) na kartach okazji, aby dodać je do porównania'
                  : `Porównaj ceny, dostępność i parametry ${comparisonState.items.length} ${comparisonState.items.length === 1 ? 'elementu' : 'elementów'}`
                }
              </SheetDescription>
            </SheetHeader>

            {comparisonState.items.length === 0 ? (
              <div className="mt-12 flex flex-col items-center justify-center gap-4 text-center">
                <Scale className="h-16 w-16 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Brak elementów do porównania</h3>
                  <p className="text-muted-foreground max-w-md">
                    Przejdź na stronę z okazjami i kliknij przycisk porównania (ikona wagi <Scale className="inline h-4 w-4" />) 
                    na kartach produktów, które chcesz porównać. Możesz dodać do 4 elementów.
                  </p>
                </div>
                <Button asChild variant="default" size="lg">
                  <Link href="/deals">
                    Przeglądaj okazje
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Smart Insights Bar */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-card border rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Łączna wartość</div>
                    <div className="text-xl font-bold">{totalValue.toFixed(2)} zł</div>
                  </div>
                  <div className="bg-card border rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Średnia cena</div>
                    <div className="text-xl font-bold">{avgPrice.toFixed(2)} zł</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">Najlepsza cena</div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">{lowestPrice.toFixed(2)} zł</div>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Możliwe oszczędności</div>
                    <div className="text-xl font-bold text-primary">{(totalValue - (lowestPrice * items.length)).toFixed(2)} zł</div>
                  </div>
                </div>

                {/* Smart Actions Bar */}
                <div className="flex gap-2 mb-4">
                  {bestDeal && bestDeal.type === 'product' && (
                    <Button
                      className="gap-2"
                      onClick={() => {
                        addToCart(bestDeal as Product);
                        toast.success('Najlepszą ofertę dodano do koszyka! 🏆');
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Dodaj najlepszą do koszyka
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      let added = 0;
                      comparisonState.items.forEach(item => {
                        if (item.type === 'product' && !isInCart((item as Product).id)) {
                          addToCart(item as Product);
                          added++;
                        }
                      });
                      if (added > 0) {
                        toast.success(`Dodano ${added} produktów do koszyka`);
                      }
                    }}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Dodaj wszystkie
                  </Button>
                </div>
                
              <div className="overflow-auto max-h-[calc(80vh-340px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] sticky left-0 bg-background">Parametr</TableHead>
                    {comparisonState.items.map((item) => (
                      <TableHead key={item.id} className="min-w-[250px]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{getTitle(item)}</p>
                            <Badge variant="outline" className="mt-1">
                              {item.type === 'deal' ? 'Okazja' : 'Produkt'}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={() => removeItem(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Price Row */}
                  <TableRow>
                    <TableCell className="font-medium sticky left-0 bg-background">Cena</TableCell>
                    {comparisonState.items.map((item) => {
                      const price = getPrice(item);
                      const isLowest = price === Math.min(...comparisonState.items.map(getPrice));
                      return (
                        <TableCell key={item.id}>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${isLowest ? 'text-green-600' : ''}`}>
                              {Number.isFinite(price) ? price.toFixed(2) : '—'} zł
                            </span>
                            {isLowest && <Check className="h-5 w-5 text-green-600" />}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  {/* Temperature Row (for deals) */}
                  {comparisonState.items.some(i => i.type === 'deal') && (
                    <TableRow>
                      <TableCell className="font-medium sticky left-0 bg-background">Temperatura</TableCell>
                      {comparisonState.items.map((item) => {
                        const temp = getTemperature(item);
                        return (
                          <TableCell key={item.id}>
                            {temp > 0 ? (
                              <div className="flex items-center gap-2">
                                <Flame className="h-5 w-5 text-orange-500" />
                                <span className="font-semibold">{temp}°</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  )}

                  {/* Shipping Row */}
                  <TableRow>
                    <TableCell className="font-medium sticky left-0 bg-background">Dostawa</TableCell>
                    {comparisonState.items.map((item) => (
                      <TableCell key={item.id}>{getShipping(item)}</TableCell>
                    ))}
                  </TableRow>

                  {/* Store Row */}
                  <TableRow>
                    <TableCell className="font-medium sticky left-0 bg-background">Sklep</TableCell>
                    {comparisonState.items.map((item) => (
                      <TableCell key={item.id}>{getStore(item)}</TableCell>
                    ))}
                  </TableRow>

                  {/* Rating Row (for products) */}
                  {comparisonState.items.some(i => i.type === 'product') && (
                    <TableRow>
                      <TableCell className="font-medium sticky left-0 bg-background">Ocena</TableCell>
                      {comparisonState.items.map((item) => {
                        if (item.type === 'product') {
                          const product = item as Product;
                          const rating = product.ratingCard?.average ?? undefined;
                          const count = product.ratingCard?.count || 0;
                          return (
                            <TableCell key={item.id}>
                              {Number.isFinite(rating) && (rating as number) > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    <span className="font-semibold">{Number(rating).toFixed(1)}</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">({count})</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Brak ocen</span>
                              )}
                            </TableCell>
                          );
                        }
                        return <TableCell key={item.id}>N/A</TableCell>;
                      })}
                    </TableRow>
                  )}

                  {/* Brand Row (for products) */}
                  {comparisonState.items.some(i => i.type === 'product') && (
                    <TableRow>
                      <TableCell className="font-medium sticky left-0 bg-background">Marka</TableCell>
                      {comparisonState.items.map((item) => {
                        if (item.type === 'product') {
                          const product = item as Product;
                          return (
                            <TableCell key={item.id}>
                              {product.metadata?.brand || 'Nieznana'}
                            </TableCell>
                          );
                        }
                        return <TableCell key={item.id}>N/A</TableCell>;
                      })}
                    </TableRow>
                  )}

                  {/* Link Row */}
                  <TableRow>
                    <TableCell className="font-medium sticky left-0 bg-background">Akcja</TableCell>
                    {comparisonState.items.map((item) => (
                      <TableCell key={item.id}>
                        <Link
                          href={`/${item.type === 'deal' ? 'deals' : 'products'}/${item.id}`}
                          target="_blank"
                        >
                          <Button variant="outline" size="sm" className="gap-2">
                            Zobacz szczegóły
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

// Hook to add items to comparison
export function useComparison() {
  const addToComparison = (item: ComparisonItem) => {
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('addToComparison', { detail: item }));
  };

  return { addToComparison };
}

// Global listener component (add to layout)
export function ComparisonListener() {
  useEffect(() => {
    const handleAdd = ((event: CustomEvent<ComparisonItem>) => {
      // This will be handled by DealComparisonTool component
      console.log('Add to comparison:', event.detail);
    }) as EventListener;

    window.addEventListener('addToComparison', handleAdd);
    return () => window.removeEventListener('addToComparison', handleAdd);
  }, []);

  return <DealComparisonTool />;
}
