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
import { Scale, X, ExternalLink, Check, Flame, Star } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

type ComparisonItem = (Deal | Product) & { type: 'deal' | 'product' };

const MAX_COMPARISON_ITEMS = 4;

export function DealComparisonTool() {
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem('comparisonItems');
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch (error) {
        console.error('Error parsing comparison items:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('comparisonItems', JSON.stringify(items));
  }, [items]);

  const addItem = (item: ComparisonItem) => {
    if (items.length >= MAX_COMPARISON_ITEMS) {
      toast.error(`Możesz porównać maksymalnie ${MAX_COMPARISON_ITEMS} elementy`);
      return;
    }

    if (items.some(i => i.id === item.id)) {
      toast.error('Ten element jest już w porównaniu');
      return;
    }

    setItems([...items, item]);
    toast.success('Dodano do porównania', {
      action: {
        label: 'Pokaż',
        onClick: () => setIsOpen(true),
      },
    });
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
    toast.success('Usunięto z porównania');
  };

  const clearAll = () => {
    setItems([]);
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

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg gap-2">
              <Scale className="h-5 w-5" />
              Porównaj ({items.length})
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Porównanie {items.length === 1 ? 'elementu' : 'elementów'}
                </span>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Wyczyść wszystko
                </Button>
              </SheetTitle>
              <SheetDescription>
                Porównaj ceny, dostępność i parametry {items.length} {items.length === 1 ? 'elementu' : 'elementów'}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 overflow-auto max-h-[calc(80vh-140px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px] sticky left-0 bg-background">Parametr</TableHead>
                    {items.map((item) => (
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
                    {items.map((item) => {
                      const price = getPrice(item);
                      const isLowest = price === Math.min(...items.map(getPrice));
                      return (
                        <TableCell key={item.id}>
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${isLowest ? 'text-green-600' : ''}`}>
                              {price.toFixed(2)} zł
                            </span>
                            {isLowest && <Check className="h-5 w-5 text-green-600" />}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  {/* Temperature Row (for deals) */}
                  {items.some(i => i.type === 'deal') && (
                    <TableRow>
                      <TableCell className="font-medium sticky left-0 bg-background">Temperatura</TableCell>
                      {items.map((item) => {
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
                    {items.map((item) => (
                      <TableCell key={item.id}>{getShipping(item)}</TableCell>
                    ))}
                  </TableRow>

                  {/* Store Row */}
                  <TableRow>
                    <TableCell className="font-medium sticky left-0 bg-background">Sklep</TableCell>
                    {items.map((item) => (
                      <TableCell key={item.id}>{getStore(item)}</TableCell>
                    ))}
                  </TableRow>

                  {/* Rating Row (for products) */}
                  {items.some(i => i.type === 'product') && (
                    <TableRow>
                      <TableCell className="font-medium sticky left-0 bg-background">Ocena</TableCell>
                      {items.map((item) => {
                        if (item.type === 'product') {
                          const product = item as Product;
                          const rating = product.ratingCard?.average || 0;
                          const count = product.ratingCard?.count || 0;
                          return (
                            <TableCell key={item.id}>
                              {rating > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    <span className="font-semibold">{rating.toFixed(1)}</span>
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
                  {items.some(i => i.type === 'product') && (
                    <TableRow>
                      <TableCell className="font-medium sticky left-0 bg-background">Marka</TableCell>
                      {items.map((item) => {
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
                    {items.map((item) => (
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
