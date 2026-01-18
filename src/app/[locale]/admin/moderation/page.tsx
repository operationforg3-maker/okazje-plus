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
import { ModerationDetailView } from '@/components/admin/moderation-detail-view';
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
          let titleText = 'Unknown item';
          if (item.title) {
            titleText = typeof item.title === 'string' ? item.title : JSON.stringify(item.title);
          } else if (item.name) {
            titleText = typeof item.name === 'string' ? item.name : JSON.stringify(item.name);
          }
          const displayName = titleText.substring(0, 30);
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
              title={titleText}
            >
              {selected[item.id] ? '✓' : ''} {displayName}...
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { getPendingDeals, getPendingProducts, getRecentlyModerated, getDealsForModeration, getProductCoresForModeration, getCategories } from '@/lib/data';
import { Deal, Product, Category } from '@/lib/types';
import DealCard from '@/components/deal-card';
import ProductListCard from '@/components/product-list-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ReportedComment {
  id: string;
  content: string;
  reportCount: number;
  createdAt: string;
  userId: string;
  parentId: string;
  parentType: 'deal' | 'product';
  parentTitle: string;
  status?: string;
}

interface Report {
  id: string;
  reportedBy: string;
  targetType: string;
  targetId: string;
  reportType: string;
  description?: string;
  status: string;
  createdAt: string;
  target?: any;
}

function ModerationPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingDeals, setPendingDeals] = useState<Deal[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [approvedItems, setApprovedItems] = useState<any[]>([]);
  const [rejectedItems, setRejectedItems] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [checkingClaims, setCheckingClaims] = useState(false);
  
  // Filtry statusów - domyślnie pending (spójność SSR/client, naprawia hydration)
  const [dealStatusFilter, setDealStatusFilter] = useState<string>('pending');
  const [productStatusFilter, setProductStatusFilter] = useState<string>('pending');
  
  // Filtry kategorii
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('');
  const [selectedSubSubCategory, setSelectedSubSubCategory] = useState<string>('');
  
  // New states for comments, reports, users
  const [reportedComments, setReportedComments] = useState<ReportedComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

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

  const fetchReportedComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/comments/moderate?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReportedComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to fetch reported comments:', error);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/reports?status=pending&limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const cats = await getCategories();
      setCategories(cats || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const handleCommentModeration = async (
    commentId: string,
    parentType: 'deal' | 'product',
    parentId: string,
    action: 'approve' | 'reject' | 'delete' | 'mark-spam'
  ) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/comments/moderate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commentId, parentType, parentId, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: 'Sukces', description: data.message || 'Komentarz zmoderowany' });
        await fetchReportedComments();
      } else {
        toast({ title: 'Błąd', description: data.error || 'Nie udało się', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    }
  };

  const handleReportAction = async (reportId: string, action: 'approve' | 'reject' | 'delete-target' | 'ignore', notes?: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportId, action, moderatorNotes: notes }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: 'Sukces', description: data.message || 'Zgłoszenie obsłużone' });
        await fetchReports();
      } else {
        toast({ title: 'Błąd', description: data.error || 'Nie udało się', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    }
  };

  const fetchModerationData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[Moderation] Fetching data...')
      
      // Pobierz z filtrami statusów - jeśli 'all', przekazujemy undefined aby pobrać wszystko
      const dealStatuses = dealStatusFilter === 'all' 
        ? undefined 
        : dealStatusFilter === 'pending' 
        ? ['pending', 'draft'] 
        : [dealStatusFilter];
      
      const productStatuses = productStatusFilter === 'all'
        ? undefined
        : productStatusFilter === 'pending'
        ? ['pending_approval', 'draft']
        : [productStatusFilter];
      
      console.log('[Moderation] Deal statuses:', dealStatuses, 'Product statuses:', productStatuses)
      
      let [deals, products, approved, rejected] = await Promise.all([
        getDealsForModeration(dealStatuses, 200),
        getProductCoresForModeration(productStatuses, 200),
        getRecentlyModerated('approved', 7),
        getRecentlyModerated('rejected', 7),
      ]);
      
      console.log('[Moderation] Got deals:', deals.length, 'products:', products.length, 'approved:', approved.length, 'rejected:', rejected.length)
      
      // Filtruj po kategoriach jeśli wybrana
      if (selectedMainCategory) {
        deals = deals.filter(d => d.mainCategorySlug === selectedMainCategory);
        products = products.filter(p => p.mainCategorySlug === selectedMainCategory);
      }
      
      if (selectedSubCategory) {
        deals = deals.filter(d => d.subCategorySlug === selectedSubCategory);
        products = products.filter(p => p.subCategorySlug === selectedSubCategory);
      }
      
      if (selectedSubSubCategory) {
        deals = deals.filter(d => d.subSubCategorySlug === selectedSubSubCategory);
        products = products.filter(p => p.subSubCategorySlug === selectedSubSubCategory);
      }
      
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
  }, [toast, dealStatusFilter, productStatusFilter, selectedMainCategory, selectedSubCategory, selectedSubSubCategory]);

  useEffect(() => {
    fetchModerationData();
  }, [fetchModerationData]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleModeration = async (itemId: string, itemType: 'deal' | 'product', action: 'approve' | 'reject') => {
    setProcessingId(itemId);
    try {
      // Pobierz token użytkownika z Firebase auth
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({ title: 'Błąd', description: 'Brak zalogowanego użytkownika', variant: 'destructive' });
        setProcessingId(null);
        return;
      }

      const token = await currentUser.getIdToken();

      const response = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
          <TabsTrigger value="comments">
            Komentarze
          </TabsTrigger>
          <TabsTrigger value="reports">
            Zgłoszenia
          </TabsTrigger>
          <TabsTrigger value="users">
            Użytkownicy
          </TabsTrigger>
          <TabsTrigger value="approved">
            Zatwierdzone
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Odrzucone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="space-y-4">
          {/* Filtry statusów i kategorii */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-medium text-sm">Filtruj po statusie:</span>
              <Select value={dealStatusFilter} onValueChange={setDealStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Wybierz status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌐 Wszystkie statusy</SelectItem>
                  <SelectItem value="pending">⏳ Pending + Draft</SelectItem>
                  <SelectItem value="approved">✅ Approved</SelectItem>
                  <SelectItem value="draft">📝 Draft</SelectItem>
                  <SelectItem value="rejected">❌ Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary">{pendingDeals.length} deali</Badge>
            </div>

            {/* Filtry kategorii */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-medium text-sm">Filtruj po kategorii:</span>
              <Select value={selectedMainCategory || 'all'} onValueChange={(val) => {
                setSelectedMainCategory(val === 'all' ? '' : val);
                setSelectedSubCategory('');
                setSelectedSubSubCategory('');
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Kategoria główna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie kategorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedMainCategory && (
                <>
                  <Select value={selectedSubCategory || 'all'} onValueChange={(val) => {
                    setSelectedSubCategory(val === 'all' ? '' : val);
                    setSelectedSubSubCategory('');
                  }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Podkategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie podkategorie</SelectItem>
                      {categories.find(c => c.slug === selectedMainCategory)?.subcategories?.map((sub) => (
                        <SelectItem key={sub.slug} value={sub.slug}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedSubCategory && (
                    <Select value={selectedSubSubCategory || 'all'} onValueChange={(val) => setSelectedSubSubCategory(val === 'all' ? '' : val)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Pod-podkategoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie pod-podkategorie</SelectItem>
                        {categories
                          .find(c => c.slug === selectedMainCategory)
                          ?.subcategories?.find(s => s.slug === selectedSubCategory)
                          ?.subcategories?.map((subsub) => (
                            <SelectItem key={subsub.slug} value={subsub.slug}>
                              {subsub.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Bulk actions bar (deals) */}
          <BulkModerationBar type="deal" items={pendingDeals} onAction={async () => fetchModerationData()} />
          <Card>
            <CardHeader>
              <CardTitle>Okazje - wszystkie statusy</CardTitle>
              <CardDescription>
                Moderacja okazji - wszystkie statusy (approved, pending, draft, rejected)
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
                    <div key={deal.id} className="flex flex-col lg:flex-row items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors">
                      {/* Podgląd karty - responsive width */}
                      <div className="w-full lg:w-[300px] lg:shrink-0">
                        <DealCard deal={deal} locale="pl" />
                      </div>
                      
                      {/* Metadane i akcje po prawej */}
                      <div className="flex-1 min-w-0 space-y-3 w-full">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{deal.title}</h3>
                          <Badge variant={
                            deal.status === 'approved' ? 'default' :
                            deal.status === 'pending' ? 'secondary' :
                            deal.status === 'draft' ? 'outline' :
                            'destructive'
                          }>{deal.status}</Badge>
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
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{deal.category}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>Dodane przez {deal.postedBy || deal.createdBy || 'Użytkownik'}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{formatDate(deal.postedAt)}</span>
                        </div>
                        
                        {/* Akcje moderacji */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                disabled={processingId === deal.id}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Podgląd pełny
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-full max-w-4xl h-screen md:h-auto max-h-[90vh] overflow-hidden flex flex-col">
                              <DialogHeader className="flex-shrink-0 overflow-hidden">
                                <DialogTitle className="truncate">Moderacja Deal: {deal.title}</DialogTitle>
                              </DialogHeader>
                              <div className="flex-1 overflow-y-auto">
                                <ModerationDetailView item={deal} itemType="deal" />
                              </div>
                            </DialogContent>
                          </Dialog>
                          
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          {/* Filtry statusów i kategorii produktów */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-medium text-sm">Filtruj po statusie:</span>
              <Select value={productStatusFilter} onValueChange={setProductStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Wybierz status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌐 Wszystkie statusy</SelectItem>
                  <SelectItem value="pending">⏳ Pending + Draft</SelectItem>
                  <SelectItem value="approved">✅ Approved</SelectItem>
                  <SelectItem value="draft">📝 Draft</SelectItem>
                  <SelectItem value="pending_approval">⏰ Pending Approval</SelectItem>
                  <SelectItem value="rejected">❌ Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary">{pendingProducts.length} produktów</Badge>
            </div>

            {/* Filtry kategorii */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-medium text-sm">Filtruj po kategorii:</span>
              <Select value={selectedMainCategory || 'all'} onValueChange={(val) => {
                setSelectedMainCategory(val === 'all' ? '' : val);
                setSelectedSubCategory('');
                setSelectedSubSubCategory('');
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Kategoria główna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie kategorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedMainCategory && (
                <>
                  <Select value={selectedSubCategory || 'all'} onValueChange={(val) => {
                    setSelectedSubCategory(val === 'all' ? '' : val);
                    setSelectedSubSubCategory('');
                  }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Podkategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie podkategorie</SelectItem>
                      {categories.find(c => c.slug === selectedMainCategory)?.subcategories?.map((sub) => (
                        <SelectItem key={sub.slug} value={sub.slug}>
                          {sub.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedSubCategory && (
                    <Select value={selectedSubSubCategory || 'all'} onValueChange={(val) => setSelectedSubSubCategory(val === 'all' ? '' : val)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Pod-podkategoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie pod-podkategorie</SelectItem>
                        {categories
                          .find(c => c.slug === selectedMainCategory)
                          ?.subcategories?.find(s => s.slug === selectedSubCategory)
                          ?.subcategories?.map((subsub) => (
                            <SelectItem key={subsub.slug} value={subsub.slug}>
                              {subsub.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
            </div>
          </div>
          
          <BulkModerationBar type="product" items={pendingProducts} onAction={async () => fetchModerationData()} />
          <Card>
            <CardHeader>
              <CardTitle>Produkty (ProductCores) - wszystkie statusy</CardTitle>
              <CardDescription>
                Moderacja produktów M6 - wszystkie statusy (approved, pending_approval, draft, rejected)
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
                    <div key={product.id} className="flex flex-col lg:flex-row items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors">
                      {/* Podgląd karty ProductCore - responsive width */}
                      <div className="w-full lg:w-[300px] lg:shrink-0">
                        <ProductListCard product={product} locale="pl" />
                      </div>
                      
                      {/* Metadane i akcje po prawej */}
                      <div className="flex-1 min-w-0 space-y-3 w-full">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{product.name}</h3>
                          <Badge variant={
                            product.status === 'approved' ? 'default' :
                            product.status === 'pending_approval' ? 'secondary' :
                            product.status === 'draft' ? 'outline' :
                            'destructive'
                          }>{product.status}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{product.category}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="font-semibold">
                            {Number.isFinite(product.price) 
                              ? `${parseFloat(product.price).toFixed(2)} zł`
                              : product.price?.amount 
                              ? `${product.price.amount.toFixed(2)} zł` 
                              : '—'}
                          </span>
                          {product.metadata?.importedAt && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span>Import: {new Date(product.metadata.importedAt).toLocaleDateString('pl-PL')}</span>
                            </>
                          )}
                        </div>
                        
                        {/* Akcje moderacji */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                disabled={processingId === product.id}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Podgląd pełny
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-full max-w-4xl h-screen md:h-auto max-h-[90vh] overflow-hidden flex flex-col">
                              <DialogHeader className="flex-shrink-0 overflow-hidden">
                                <DialogTitle className="truncate">Moderacja ProductCore: {product.name || product.title?.pl}</DialogTitle>
                              </DialogHeader>
                              <div className="flex-1 overflow-y-auto">
                                <ModerationDetailView item={product} itemType="product" />
                              </div>
                            </DialogContent>
                          </Dialog>
                          
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
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Komentarze zgłoszone do moderacji</CardTitle>
              <CardDescription>
                Komentarze oznaczone jako spam lub zgłoszone przez użytkowników
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Button onClick={fetchReportedComments} disabled={loadingComments}>
                  {loadingComments ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Odśwież listę
                </Button>
              </div>

              {loadingComments ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : reportedComments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak zgłoszonych komentarzy</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reportedComments.map((comment) => (
                    <div key={comment.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="destructive">{comment.reportCount} zgłoszeń</Badge>
                            <Badge variant="outline">{comment.parentType === 'deal' ? 'Okazja' : 'Produkt'}</Badge>
                            {comment.status && <Badge variant="secondary">{comment.status}</Badge>}
                          </div>
                          <p className="text-sm font-medium mb-1">
                            Pod: {comment.parentTitle || 'Nieznany tytuł'}
                          </p>
                          <p className="text-sm text-muted-foreground mb-2">
                            {formatDate(comment.createdAt)}
                          </p>
                          <div className="bg-muted p-3 rounded">
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleCommentModeration(comment.id, comment.parentType, comment.parentId, 'approve')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Zatwierdź
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCommentModeration(comment.id, comment.parentType, comment.parentId, 'reject')}
                        >
                          Odrzuć
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (window.confirm('Czy na pewno chcesz usunąć ten komentarz?')) {
                              handleCommentModeration(comment.id, comment.parentType, comment.parentId, 'delete');
                            }
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Usuń
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-red-950 text-red-50"
                          onClick={() => {
                            if (window.confirm('Oznacz jako spam? Autor straci 10 punktów reputacji.')) {
                              handleCommentModeration(comment.id, comment.parentType, comment.parentId, 'mark-spam');
                            }
                          }}
                        >
                          🚫 Spam
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zgłoszenia użytkowników</CardTitle>
              <CardDescription>
                Treści zgłoszone przez użytkowników jako spam, duplikaty lub nieprawidłowe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Button onClick={fetchReports} disabled={loadingReports}>
                  {loadingReports ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Odśwież listę
                </Button>
              </div>

              {loadingReports ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak oczekujących zgłoszeń</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <div key={report.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{report.reportType}</Badge>
                            <Badge variant="secondary">{report.targetType}</Badge>
                            <Badge>{report.status}</Badge>
                          </div>
                          {report.target && (
                            <p className="text-sm font-medium mb-1">
                              Zgłoszono: {report.target.title || report.target.name || report.targetId}
                            </p>
                          )}
                          {report.description && (
                            <p className="text-sm text-muted-foreground mb-2">{report.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Zgłoszone: {formatDate(report.createdAt)} przez {report.reportedBy}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleReportAction(report.id, 'approve')}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Zaakceptuj
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (window.confirm('Czy na pewno chcesz usunąć zgłoszoną treść?')) {
                              handleReportAction(report.id, 'delete-target', 'Confirmed by moderator');
                            }
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Usuń treść
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReportAction(report.id, 'reject', 'False report')}
                        >
                          Odrzuć zgłoszenie
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleReportAction(report.id, 'ignore', 'Ignored by moderator')}
                        >
                          Ignoruj
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zarządzanie użytkownikami</CardTitle>
              <CardDescription>
                Banowanie, zawieszanie i zarządzanie rolami użytkowników
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Dostępne akcje przez API:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• <code>POST /api/admin/users/[userId]/moderate</code> - Ban/suspend/change role</li>
                    <li>• <code>GET /api/admin/users/[userId]/moderate</code> - Historia moderacji</li>
                  </ul>
                </div>

                <div className="border rounded p-4 space-y-3">
                  <h4 className="font-semibold">Przykład: Ban użytkownika</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`POST /api/admin/users/{userId}/moderate
{
  "action": "ban",
  "reason": "Spam and offensive content"
}`}
                  </pre>
                </div>

                <div className="border rounded p-4 space-y-3">
                  <h4 className="font-semibold">Przykład: Zawieś na 7 dni</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`POST /api/admin/users/{userId}/moderate
{
  "action": "suspend",
  "duration": 7,
  "reason": "Repeated violations"
}`}
                  </pre>
                </div>

                <div className="border rounded p-4 space-y-3">
                  <h4 className="font-semibold">Przykład: Zmień rolę na moderatora</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`POST /api/admin/users/{userId}/moderate
{
  "action": "change-role",
  "role": "moderator"
}`}
                  </pre>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Uwaga:</strong> Pełny UI do zarządzania użytkownikami będzie dodany w następnej iteracji.
                    Obecnie wszystkie funkcje są dostępne przez API endpointy.
                  </p>
                </div>
              </div>
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
