// @ts-nocheck
'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { auth } from '@/lib/firebase';
import { useEffect, useState, useCallback } from 'react';
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
  Eye,
  RefreshCw
} from 'lucide-react';

interface BulkItem { id: string; type: 'deal' | 'product'; }

function BulkModerationBar({ type, items, onAction }: { type: 'deal' | 'product'; items: any[]; onAction: () => Promise<void> }) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState(false);
  const [loadingAllItems, setLoadingAllItems] = useState(false);
  const [totalItemsInDb, setTotalItemsInDb] = useState<number | null>(null);
  const { toast } = useToast();

  const toggle = (id: string) => setSelected(p => ({ ...p, [id]: !p[id] }));
  const clear = () => setSelected({});
  const selectAll = () => {
    const all: Record<string, boolean> = {};
    items.forEach(item => all[item.id] = true);
    setSelected(all);
  };
  
  const selectAllInDatabase = async () => {
    try {
      setLoadingAllItems(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({ title: 'Błąd', description: 'Brak zalogowanego użytkownika', variant: 'destructive' });
        return;
      }
      const token = await currentUser.getIdToken();
      
      // Pobierz wszystkie IDs z bazy
      const res = await fetch(`/api/admin/moderation/get-all-ids?type=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Nie udało się pobrać wszystkich ID');
      
      const data = await res.json();
      const allIds: Record<string, boolean> = {};
      data.ids.forEach((id: string) => allIds[id] = true);
      setSelected(allIds);
      setTotalItemsInDb(data.total);
      
      toast({ 
        title: 'Zaznaczono wszystkie', 
        description: `Zaznaczono ${data.total} ${type === 'deal' ? 'okazji' : 'produktów'} z bazy danych` 
      });
    } catch (error: any) {
      toast({ title: 'Błąd', description: error.message || 'Nie udało się pobrać wszystkich itemów', variant: 'destructive' });
    } finally {
      setLoadingAllItems(false);
    }
  };
  
  const allSelectedIds = Object.entries(selected).filter(([, v]) => v).map(([id]) => id);

  async function bulk(action: 'approve' | 'reject' | 'delete' | 'change-status', status?: string) {
    if (allSelectedIds.length === 0) {
      toast({ title: 'Błąd', description: 'Nie zaznaczono żadnych elementów', variant: 'destructive' });
      return;
    }

    const confirmed = action === 'delete' 
      ? window.confirm(`Czy na pewno chcesz usunąć ${allSelectedIds.length} elementów?`)
      : true;

    if (!confirmed) return;

    setProcessing(true);
    try {
      // Pobierz token użytkownika z Firebase auth
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({ title: 'Błąd', description: 'Brak zalogowanego użytkownika', variant: 'destructive' });
        setProcessing(false);
        return;
      }

      const token = await currentUser.getIdToken();

      const res = await fetch('/api/admin/moderation/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          items: allSelectedIds.map(id => ({ id, type })), 
          action,
          ...(status && { status })
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const message = data.message || `Przetworzono ${data.processed || allSelectedIds.length} elementów`;
        const description = data.processed && data.total && data.processed < data.total 
          ? `Przetworzono ${data.processed}/${data.total} elementów`
          : undefined;
        toast({ 
          title: 'Sukces', 
          description: description || message,
          duration: 5000
        });
        clear();
        setTotalItemsInDb(null); // Reset counter po akcji
        await onAction();
      } else {
        toast({ title: 'Błąd', description: data.message || 'Wystąpił błąd', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Błąd', description: 'Nie udało się przetworzyć akcji', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-2 border rounded-md p-3 bg-muted/30">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          Zbiorcza moderacja: {type === 'deal' ? 'Okazje' : 'Produkty'} 
          <Badge variant="secondary" className="ml-2">{allSelectedIds.length} zaznaczonych</Badge>
          {totalItemsInDb && totalItemsInDb > items.length && (
            <Badge variant="outline" className="ml-1 text-xs">z {totalItemsInDb} w bazie</Badge>
          )}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={selectAll} disabled={processing || items.length === 0}>
            Zaznacz widoczne ({items.length})
          </Button>
          <Button 
            size="sm" 
            variant="default" 
            onClick={selectAllInDatabase} 
            disabled={loadingAllItems || processing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loadingAllItems ? 'Ładowanie...' : '🌐 Zaznacz wszystkie w bazie'}
          </Button>
          <Button size="sm" variant="outline" onClick={clear} disabled={processing || allSelectedIds.length === 0}>
            Wyczyść
          </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={() => bulk('approve')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Zatwierdź ({allSelectedIds.length})
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => bulk('reject')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Odrzuć ({allSelectedIds.length})
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => bulk('change-status', 'draft')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          Zmień na Draft
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => bulk('change-status', 'pending')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          Zmień na Pending
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="bg-red-950 text-red-50 hover:bg-red-900"
          onClick={() => bulk('delete')} 
          disabled={processing || allSelectedIds.length === 0}
        >
          🗑️ Usuń ({allSelectedIds.length})
        </Button>
      </div>

      <div className="flex gap-1 flex-wrap max-h-32 overflow-y-auto">
        {items.map(item => {
          const displayName = (item.title || item.name || 'Unknown item').toString().substring(0, 30);
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={
                "text-xs px-2 py-1 rounded border transition-colors " + 
                (selected[item.id] 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-background hover:bg-accent')
              }
              title={item.title || item.name || 'Unknown item'}
            >
              {selected[item.id] ? '✓' : ''} {displayName}...
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [checkingClaims, setCheckingClaims] = useState(false);

  const handleFixAdminClaims = async () => {
    setCheckingClaims(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({ title: 'Błąd', description: 'Nie jesteś zalogowany', variant: 'destructive' });
        return;
      }

      // Sprawdź i napraw claims
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/refresh-claims', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (data.wasSynced) {
        toast({ 
          title: 'Zsynchronizowano uprawnienia', 
          description: 'Odświeżam token...'
        });
        
        // Force refresh tokena po naprawieniu claims
        await currentUser.getIdToken(true);
        
        toast({ 
          title: 'Gotowe!', 
          description: 'Uprawnienia admina zostały zaktualizowane. Odśwież stronę.'
        });
        
        // Auto-refresh po 2 sekundach
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast({ 
          title: 'Wszystko OK', 
          description: data.isAdmin 
            ? 'Masz prawidłowe uprawnienia admina' 
            : 'Brak uprawnień admina w systemie'
        });
      }
    } catch (error: any) {
      toast({ 
        title: 'Błąd', 
        description: error.message || 'Nie udało się sprawdzić uprawnień', 
        variant: 'destructive' 
      });
    } finally {
      setCheckingClaims(false);
    }
  };

  const fetchModerationData = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => {
    fetchModerationData();
  }, [fetchModerationData]);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Panel moderacji</h2>
          <p className="text-muted-foreground">
            Zatwierdzaj i odrzucaj nowe treści
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFixAdminClaims}
          disabled={checkingClaims}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${checkingClaims ? 'animate-spin' : ''}`} />
          {checkingClaims ? 'Sprawdzam...' : 'Napraw uprawnienia'}
        </Button>
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
          {/* Bulk actions bar (deals) */}
          <BulkModerationBar type="deal" items={pendingDeals} onAction={async () => fetchModerationData()} />
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
                          {deal.source && (
                            <Badge variant="outline" className={
                              deal.source === 'api' || deal.source === 'ai' 
                                ? 'bg-blue-50 text-blue-700 border-blue-300' 
                                : 'bg-gray-50'
                            }>
                              {deal.source === 'api' ? '🤖 API' : deal.source === 'ai' ? '✨ AI' : '👤 Manual'}
                            </Badge>
                          )}
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
          <BulkModerationBar type="product" items={pendingProducts} onAction={async () => fetchModerationData()} />
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
                          <span className="font-semibold">
                            {Number.isFinite(product.price) 
                              ? `${parseFloat(product.price).toFixed(2)} zł`
                              : product.price?.amount 
                              ? `${product.price.amount.toFixed(2)} zł` 
                              : '—'}
                          </span>
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
