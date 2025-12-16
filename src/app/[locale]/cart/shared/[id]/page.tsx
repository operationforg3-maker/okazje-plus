"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Copy, Check, ExternalLink, AlertCircle, User, Calendar, Eye } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useSmartCart } from '@/lib/cart-context';

interface SharedCartData {
  shareId: string;
  items: Array<{
    productId: string;
    productName: string;
    productImage: string;
    productPrice: number;
    affiliateUrl: string;
    quantity: number;
    notes?: string | null;
  }>;
  metadata: {
    itemCount: number;
    totalAmount: number;
    totalWithShipping: number;
    createdBy: string;
    createdByName: string;
    createdByEmail?: string | null;
  };
  createdAt: string;
  expiresAt: string;
  views: number;
  status: string;
}

function SharedCartPageContent() {
  const params = useParams();
  const shareId = params.id as string;
  const [cartData, setCartData] = useState<SharedCartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { addItem } = useSmartCart();

  useEffect(() => {
    if (!shareId) return;

    const loadCart = async () => {
      try {
        const response = await fetch(`/api/cart/share?id=${shareId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load cart');
        }

        const data = await response.json();
        setCartData(data.cart);
      } catch (err: any) {
        setError(err.message || 'Failed to load shared cart');
      } finally {
        setIsLoading(false);
      }
    };

    loadCart();
  }, [shareId]);

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link skopiowany do schowka!');
    setTimeout(() => setCopied(false), 2000);
  };

  const addAllToMyCart = () => {
    if (!cartData) return;
    
    let added = 0;
    cartData.items.forEach(item => {
      // Reconstruct minimal product object for cart
      const product = {
        id: item.productId,
        name: item.productName,
        image: item.productImage,
        price: item.productPrice,
        affiliateUrl: item.affiliateUrl,
      } as any;
      
      addItem(product, item.quantity);
      added++;
    });

    toast.success(`Dodano ${added} produktów do Twojego koszyka!`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Ładowanie koszyka...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center space-sm text-destructive mb-2">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Błąd</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/">Wróć na stronę główną</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!cartData) {
    return null;
  }

  const expiresDate = new Date(cartData.expiresAt);
  const createdDate = new Date(cartData.createdAt);
  const daysLeft = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-4xl mx-auto px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl flex items-center space-sm">
                  <ShoppingCart className="h-6 w-6" />
                  Udostępniony koszyk
                </CardTitle>
                <CardDescription className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    Utworzył: <span className="font-medium">{cartData.metadata.createdByName}</span>
                  </div>
                  <div className="flex items-center space-sm text-sm">
                    <Calendar className="h-4 w-4" />
                    {createdDate.toLocaleDateString('pl-PL', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      timeZone: 'UTC'
                    })}
                  </div>
                  <div className="flex items-center space-sm text-sm">
                    <Eye className="h-4 w-4" />
                    Wyświetlenia: {cartData.views}
                  </div>
                </CardDescription>
              </div>
              <Badge variant={daysLeft > 7 ? 'default' : 'destructive'}>
                Wygasa za {daysLeft} dni
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 space-md">
              <div className="bg-muted rounded-md p-compact">
                <div className="text-2xl font-bold">{cartData.metadata.itemCount}</div>
                <div className="text-xs text-muted-foreground">Produktów</div>
              </div>
              <div className="bg-muted rounded-md p-compact">
                <div className="text-2xl font-bold">{cartData.metadata.totalAmount.toFixed(2)} zł</div>
                <div className="text-xs text-muted-foreground">Wartość produktów</div>
              </div>
              <div className="bg-primary/10 rounded-md p-compact col-span-2 md:col-span-1">
                <div className="text-2xl font-bold text-primary">{cartData.metadata.totalWithShipping.toFixed(2)} zł</div>
                <div className="text-xs text-muted-foreground">Z dostawą</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row space-sm">
              <Button onClick={addAllToMyCart} className="flex-1">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Dodaj wszystko do mojego koszyka
              </Button>
              <Button variant="outline" onClick={copyLink}>
                {copied ? (
                  <><Check className="h-4 w-4 mr-2" /> Skopiowano!</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" /> Kopiuj link</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Produkty w koszyku</h2>
          {cartData.items.map((item, index) => (
            <Card key={index}>
              <CardContent className="p-compact">
                <div className="flex space-md">
                  {/* Image */}
                  <div className="relative w-24 h-24 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                    {item.productImage && (
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium line-clamp-2 mb-2">{item.productName}</h3>
                    <div className="flex items-center space-md text-sm text-muted-foreground">
                      <span>Ilość: {item.quantity}</span>
                      <span className="font-semibold text-foreground">{item.productPrice.toFixed(2)} zł</span>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        Notatka: {item.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col space-sm">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link href={item.affiliateUrl} target="_blank">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Kup
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
export default function SharedCartPageWrapper() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Ładowanie...</p>
        </div>
      </div>
    );
  }

  return <SharedCartPageContent />;
}