'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckSquare, 
  Clock,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPendingDeals, getPendingProducts, getRecentlyModerated } from '@/lib/data';
import { Deal, Product } from '@/lib/types';

function ModerationPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingDeals, setPendingDeals] = useState<Deal[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [approvedItems, setApprovedItems] = useState<any[]>([]);
  const [rejectedItems, setRejectedItems] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchModerationData();
  }, []);

  const fetchModerationData = async () => {
    setLoading(true);
    try {
      const [deals, products, approved, rejected] = await Promise.all([
        getPendingDeals(),
        getPendingProducts(),
        getRecentlyModerated('approved', 7),
        getRecentlyModerated('rejected', 7),
      ]);
      
      setPendingDeals(deals);
      setPendingProducts(products);
      setApprovedItems(approved);
      setRejectedItems(rejected);
    } catch (error) {
      console.error('Błąd podczas pobierania danych moderacji:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się pobrać danych do moderacji',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModeration = async (itemId: string, itemType: 'deal' | 'product', action: 'approve' | 'reject') => {
    setProcessingId(itemId);
    try {
      const response = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, itemType, action }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Sukces',
          description: data.message,
        });
        // Odśwież dane
        await fetchModerationData();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Błąd moderacji:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się przetworzyć akcji moderacji',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Panel moderacji</h2>
        <p className="text-muted-foreground">
          Zatwierdzaj i odrzucaj nowe treści
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Do moderacji</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDeals.length + pendingProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Oczekuje na akcję
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zatwierdzone (7 dni)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : approvedItems.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ostatnie 7 dni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Odrzucone (7 dni)</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : rejectedItems.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ostatnie 7 dni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Średni czas reakcji</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Skeleton className="h-8 w-16" /> : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              Ostatnie 7 dni
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Moderation Queue */}
      <Tabs defaultValue="deals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deals">
            Okazje ({pendingDeals.length})
          </TabsTrigger>
          <TabsTrigger value="products">
            Produkty ({pendingProducts.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Zatwierdzone
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Odrzucone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Okazje oczekujące na moderację</CardTitle>
              <CardDescription>
                Nowe okazje dodane przez użytkowników
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : pendingDeals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak okazji do moderacji</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDeals.map((deal) => (
                    <div key={deal.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{deal.title}</h3>
                          <Badge variant="secondary">{deal.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{deal.category}</span>
                          <span>•</span>
                          <span>Dodane przez {deal.postedBy || deal.createdBy || 'Użytkownik'}</span>
                          <span>•</span>
                          <span>{formatDate(deal.postedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={processingId === deal.id}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Podgląd
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleModeration(deal.id, 'deal', 'reject')}
                          disabled={processingId === deal.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Odrzuć
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleModeration(deal.id, 'deal', 'approve')}
                          disabled={processingId === deal.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Zatwierdź
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Produkty oczekujące na moderację</CardTitle>
              <CardDescription>
                Nowe produkty dodane przez administratorów lub import
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : pendingProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak produktów do moderacji</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{product.name}</h3>
                          <Badge variant="secondary">{product.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{product.category}</span>
                          <span>•</span>
                          <span className="font-semibold">{product.price.toLocaleString('pl-PL')} zł</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={processingId === product.id}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Podgląd
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => handleModeration(product.id, 'product', 'reject')}
                          disabled={processingId === product.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Odrzuć
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleModeration(product.id, 'product', 'approve')}
                          disabled={processingId === product.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Zatwierdź
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ostatnio zatwierdzone (7 dni)</CardTitle>
              <CardDescription>
                Historia zatwierdzonych treści
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : approvedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak ostatnio zatwierdzonych treści</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {approvedItems.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">
                            {item.type === 'deal' ? item.title : item.name}
                          </h3>
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            {item.type === 'deal' ? 'Okazja' : 'Produkt'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.category}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ostatnio odrzucone (7 dni)</CardTitle>
              <CardDescription>
                Historia odrzuconych treści
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : rejectedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak ostatnio odrzuconych treści</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rejectedItems.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">
                            {item.type === 'deal' ? item.title : item.name}
                          </h3>
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            {item.type === 'deal' ? 'Okazja' : 'Produkt'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.category}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(ModerationPage);
