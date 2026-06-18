// @ts-nocheck
'use client';

export const dynamic = 'force-dynamic';

const DEBUG_MODERATION_LOGS = process.env.NEXT_PUBLIC_DEBUG === 'true';

import { withAuth } from '@/components/auth/withAuth';
import { auth } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { withImageProxy } from '@/lib/image-proxy';
import { ModerationDetailView } from '@/components/admin/moderation-detail-view';
import { 
  CheckSquare, 
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Sparkles
} from 'lucide-react';

import { BulkModerationBar } from '@/components/admin/moderation/bulk-moderation-bar';
import { ModerationFilters } from '@/components/admin/moderation/moderation-filters';

import { getCategories } from '@/lib/data';
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
  const t = useTranslations('admin.common');
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingDeals, setPendingDeals] = useState<Deal[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [approvedItems, setApprovedItems] = useState<any[]>([]);
  const [rejectedItems, setRejectedItems] = useState<any[]>([]);
  const [discardedItems, setDiscardedItems] = useState<any[]>([]);
  const [discardedSelection, setDiscardedSelection] = useState<Record<string, boolean>>({});
  const [discardedProcessing, setDiscardedProcessing] = useState(false);
  const [discardedProgress, setDiscardedProgress] = useState(0);
  const [discardedLastResult, setDiscardedLastResult] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [checkingClaims, setCheckingClaims] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  
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

  const getLocalizedTitle = (value: any): string => {
    if (!value) return 'Bez tytułu';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.pl || value.en || value.de || 'Bez tytułu';
    }
    return 'Bez tytułu';
  };

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

  const handleTriggerBackfill = async () => {
    setIsBackfilling(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({ title: 'Błąd', description: 'Nie jesteś zalogowany', variant: 'destructive' });
        return;
      }

      const token = await currentUser.getIdToken();
      const res = await fetch('/api/admin/moderation/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          dryRun: false,
          approvedOnly: true,
          maxScanPerCollection: 10000,
          maxProcessPerType: 400,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || data?.message || 'Nie udało się uruchomić backfillu');
      }

      const dealsProcessed = Number(data?.processed?.deals || 0);
      const productsProcessed = Number(data?.processed?.products || 0);
      const dealsMissing = Number(data?.missing?.deals || 0);
      const productsMissing = Number(data?.missing?.products || 0);
      const hasMoreDeals = Boolean(data?.hasMore?.deals);
      const hasMoreProducts = Boolean(data?.hasMore?.products);

      const hasMoreText = hasMoreDeals || hasMoreProducts
        ? ' Wykryto więcej braków w zatwierdzonych rekordach — uruchom przycisk ponownie, aby dokończyć kolejną paczkę.'
        : '';

      toast({
        title: 'Backfill uruchomiony',
        description: `Przetworzono: deale ${dealsProcessed}/${dealsMissing}, produkty ${productsProcessed}/${productsMissing}.${hasMoreText}`,
        duration: 9000,
      });

      await fetchModerationData();
    } catch (error: any) {
      toast({
        title: 'Błąd backfillu',
        description: error?.message || 'Nie udało się uruchomić backfillu',
        variant: 'destructive',
      });
    } finally {
      setIsBackfilling(false);
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
      if (DEBUG_MODERATION_LOGS) {
        console.log('[Moderation] Fetching data...')
      }
      
      // Pobierz z filtrami statusów - jeśli 'all', przekazujemy undefined aby pobrać wszystko
      const dealStatuses = dealStatusFilter === 'all' 
        ? undefined 
        : dealStatusFilter === 'pending' 
        ? ['pending', 'poczekalnia', 'draft'] 
        : [dealStatusFilter];
      
      const productStatuses = productStatusFilter === 'all'
        ? undefined
        : productStatusFilter === 'pending'
        ? ['pending_approval', 'draft']
        : [productStatusFilter];
      
      if (DEBUG_MODERATION_LOGS) {
        console.log('[Moderation] Deal statuses:', dealStatuses, 'Product statuses:', productStatuses)
      }
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const token = await currentUser.getIdToken();
      const qs = new URLSearchParams();
      if (dealStatuses) qs.set('dealStatuses', dealStatuses.join(','));
      if (productStatuses) qs.set('productStatuses', productStatuses.join(','));
      qs.set('limit', '200');
      qs.set('includeRecent', '1');

      const res = await fetch(`/api/admin/moderation/data?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401 || res.status === 403) {
        setLoading(false);
        return;
      }

      const payload = await res.json();
      let deals = payload.deals || [];
      let products = payload.products || [];
      let approved = payload.approved || [];
      let rejected = payload.rejected || [];
      let discarded = payload.discarded || [];
      
      if (DEBUG_MODERATION_LOGS) {
        console.log('[Moderation] Got deals:', deals.length, 'products:', products.length, 'approved:', approved.length, 'rejected:', rejected.length)
      }
      
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
      setDiscardedItems(discarded);
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
  }, [fetchCategories]);

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
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTriggerBackfill}
            disabled={isBackfilling}
          >
            <Sparkles className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-pulse' : ''}`} />
            {isBackfilling ? 'Backfill w toku...' : 'Uruchom backfill braków'}
          </Button>
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
          <TabsTrigger value="discarded">
            Odfiltrowane importy ({discardedItems.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="space-y-4">
          {/* Filtry statusów i kategorii */}
          <ModerationFilters
            type="deals"
            statusFilter={dealStatusFilter}
            setStatusFilter={setDealStatusFilter}
            categories={categories}
            selectedMainCategory={selectedMainCategory}
            setSelectedMainCategory={setSelectedMainCategory}
            selectedSubCategory={selectedSubCategory}
            setSelectedSubCategory={setSelectedSubCategory}
            selectedSubSubCategory={selectedSubSubCategory}
            setSelectedSubSubCategory={setSelectedSubSubCategory}
            itemsCount={pendingDeals.length}
          />
          
          {/* Bulk actions bar (deals) */}
          <BulkModerationBar type="deal" items={pendingDeals} onAction={async () => fetchModerationData()} />
          <Card>
            <CardHeader>
              <CardTitle>Okazje - wszystkie statusy</CardTitle>
              <CardDescription>
                Moderacja okazji - wszystkie statusy (zatwierdzone, poczekalnia, szkic, odrzucone)
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
                          <h3 className="font-semibold truncate">{getLocalizedTitle(deal.title)}</h3>
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
                          <span>{getLocalizedTitle(deal.category)}</span>
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
                                <DialogTitle className="truncate">Moderacja Deal: {getLocalizedTitle(deal.title)}</DialogTitle>
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
          <ModerationFilters
            type="products"
            statusFilter={productStatusFilter}
            setStatusFilter={setProductStatusFilter}
            categories={categories}
            selectedMainCategory={selectedMainCategory}
            setSelectedMainCategory={setSelectedMainCategory}
            selectedSubCategory={selectedSubCategory}
            setSelectedSubCategory={setSelectedSubCategory}
            selectedSubSubCategory={selectedSubSubCategory}
            setSelectedSubSubCategory={setSelectedSubSubCategory}
            itemsCount={pendingProducts.length}
          />
          
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
                  {pendingProducts.map((product) => {
                    const productTitle = getLocalizedTitle(product.title || product.name);
                    const productCategory = getLocalizedTitle(product.category);
                    return (
                    <div key={product.id} className="flex flex-col lg:flex-row items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors">
                      {/* Podgląd karty ProductCore - responsive width */}
                      <div className="w-full lg:w-[300px] lg:shrink-0">
                        <ProductListCard product={product} locale="pl" />
                      </div>
                      
                      {/* Metadane i akcje po prawej */}
                      <div className="flex-1 min-w-0 space-y-3 w-full">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate max-w-[300px]" title={productTitle}>
                              {productTitle}
                          </h3>
                          <Badge variant={
                            product.status === 'approved' ? 'default' :
                            product.status === 'pending_approval' ? 'secondary' :
                            product.status === 'draft' ? 'outline' :
                            'destructive'
                          }>{product.status}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{productCategory}</span>
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
                                <DialogTitle className="truncate">Moderacja ProductCore: {productTitle || 'Unknown'}</DialogTitle>
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
                  );
                })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discarded" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Odfiltrowane importy</CardTitle>
              <CardDescription>
                Pozycje znalezione przez import, ale odrzucone przez filtr jakości lub brak danych.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Toolbar for discarded items - restore/delete actions */}
              {discardedItems.length > 0 && (
                <div className="mb-4 space-y-2 border rounded-md p-3 bg-muted/30">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">
                      Akcje: {Object.values(discardedSelection).filter(Boolean).length} zaznaczonych
                    </span>
                    <div className="ml-auto flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          const all: Record<string, boolean> = {};
                          discardedItems.forEach(item => all[item.id] = true);
                          setDiscardedSelection(all);
                        }}
                        disabled={discardedProcessing}
                      >
                        Zaznacz wszystkie ({discardedItems.length})
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setDiscardedSelection({})}
                        disabled={discardedProcessing || Object.values(discardedSelection).every(v => !v)}
                      >
                        Wyczyść
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={async () => {
                        const selectedIds = Object.entries(discardedSelection).filter(([, v]) => v).map(([id]) => id);
                        if (selectedIds.length === 0) {
                          toast({ title: 'Błąd', description: 'Nie zaznaczono żadnych elementów', variant: 'destructive' });
                          return;
                        }
                        setDiscardedProcessing(true);
                        setDiscardedProgress(0);
                        setDiscardedLastResult(null);
                        try {
                          const currentUser = auth.currentUser;
                          if (!currentUser) {
                            toast({ title: 'Błąd', description: 'Brak zalogowanego użytkownika', variant: 'destructive' });
                            return;
                          }

                          const token = await currentUser.getIdToken();
                          const progressInterval = setInterval(() => {
                            setDiscardedProgress(prev => Math.min(prev + 1, selectedIds.length - 1));
                          }, 100);

                          const res = await fetch('/api/admin/moderation/restore-discarded', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ 
                              items: selectedIds.map(id => ({ id, type: 'product' })),
                              targetStatus: 'pending'
                            })
                          });
                          
                          clearInterval(progressInterval);
                          setDiscardedProgress(selectedIds.length);

                          const data = await res.json();
                          setDiscardedLastResult(data);

                          if (res.ok && data.success) {
                            toast({ 
                              title: 'Sukces', 
                              description: `Przywrócono ${data.processed}/${data.total} elementów`
                            });
                            setDiscardedSelection({});
                            await new Promise(r => setTimeout(r, 500));
                            await loadData();
                          } else {
                            toast({ 
                              title: 'Błąd', 
                              description: data.message || 'Nie udało się przywrócić',
                              variant: 'destructive'
                            });
                          }
                        } catch (error: any) {
                          toast({ 
                            title: 'Błąd sieciowy', 
                            description: error.message || 'Nie udało się przywrócić',
                            variant: 'destructive' 
                          });
                        } finally {
                          setDiscardedProcessing(false);
                          setDiscardedProgress(0);
                        }
                      }}
                      disabled={discardedProcessing || Object.values(discardedSelection).every(v => !v)}
                    >
                      ↩️ Przywróć
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        const selectedIds = Object.entries(discardedSelection).filter(([, v]) => v).map(([id]) => id);
                        if (selectedIds.length === 0) {
                          toast({ title: 'Błąd', description: 'Nie zaznaczono żadnych elementów', variant: 'destructive' });
                          return;
                        }
                        if (!window.confirm(`Czy na pewno chcesz trwale usunąć ${selectedIds.length} elementów?`)) return;
                        
                        setDiscardedProcessing(true);
                        setDiscardedProgress(0);
                        setDiscardedLastResult(null);
                        try {
                          const currentUser = auth.currentUser;
                          if (!currentUser) {
                            toast({ title: 'Błąd', description: 'Brak zalogowanego użytkownika', variant: 'destructive' });
                            return;
                          }

                          const token = await currentUser.getIdToken();
                          const progressInterval = setInterval(() => {
                            setDiscardedProgress(prev => Math.min(prev + 1, selectedIds.length - 1));
                          }, 100);

                          const res = await fetch('/api/admin/moderation/delete-discarded', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ ids: selectedIds })
                          });
                          
                          clearInterval(progressInterval);
                          setDiscardedProgress(selectedIds.length);

                          const data = await res.json();
                          setDiscardedLastResult(data);

                          if (res.ok && data.success) {
                            toast({ 
                              title: 'Sukces', 
                              description: `Usunięto ${data.processed}/${data.total} elementów`
                            });
                            setDiscardedSelection({});
                            await new Promise(r => setTimeout(r, 500));
                            await loadData();
                          } else {
                            toast({ 
                              title: 'Błąd', 
                              description: data.message || 'Nie udało się usunąć',
                              variant: 'destructive'
                            });
                          }
                        } catch (error: any) {
                          toast({ 
                            title: 'Błąd sieciowy', 
                            description: error.message || 'Nie udało się usunąć',
                            variant: 'destructive' 
                          });
                        } finally {
                          setDiscardedProcessing(false);
                          setDiscardedProgress(0);
                        }
                      }}
                      disabled={discardedProcessing || Object.values(discardedSelection).every(v => !v)}
                    >
                      🗑️ Usuń
                    </Button>
                  </div>

                  {/* Progress bar */}
                  {discardedProcessing && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span>Przetwarzanie...</span>
                        <span className="text-slate-600">{discardedProgress}/{Object.values(discardedSelection).filter(Boolean).length}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full transition-all duration-200"
                          style={{ width: `${Object.values(discardedSelection).filter(Boolean).length > 0 ? Math.round((discardedProgress / Object.values(discardedSelection).filter(Boolean).length) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error details */}
                  {discardedLastResult?.failures && discardedLastResult.failures.length > 0 && !discardedProcessing && (
                    <div className="border border-red-300 bg-red-50 rounded-md p-2 text-sm">
                      <div className="font-semibold text-red-800 mb-1">
                        🚨 {discardedLastResult.failures.length} błędów:
                      </div>
                      <details className="cursor-pointer">
                        <summary className="text-red-700 hover:text-red-900 font-medium">Pokaż szczegóły</summary>
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {discardedLastResult.failures.map((fail: any, idx: number) => (
                            <div key={idx} className="text-xs text-red-800 font-mono bg-white/50 p-1 rounded">
                              <strong>{fail.id}</strong>: {fail.error || 'Nieznany błąd'}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              )}

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : discardedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak odfiltrowanych importów</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {discardedItems.map((item: any) => (
                    <div key={item.id} className="flex flex-col lg:flex-row items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors">
                      {(() => {
                        const normalizeText = (value: unknown, fallback = ''): string => {
                          if (typeof value === 'string') return value;
                          if (typeof value === 'number' || typeof value === 'boolean') return String(value);
                          if (value == null) return fallback;
                          try {
                            return JSON.stringify(value);
                          } catch {
                            return fallback;
                          }
                        };

                        const safeTitle = normalizeText(item.title, 'Bez tytułu');
                        const safeQuery = normalizeText(item.query, '');

                        return (
                          <>
                      <div className="w-full lg:w-[160px] lg:shrink-0">
                        <div className="w-full h-[120px] bg-muted rounded-md overflow-hidden border">
                          {item.imageUrl ? (
                            <img src={withImageProxy(item.imageUrl)} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                              Brak zdjęcia
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold truncate" title={safeTitle || 'Bez tytułu'}>
                            {safeTitle || 'Bez tytułu'}
                          </h3>
                          <Badge variant="outline">{item.source || 'źródło'}</Badge>
                          {item.type && <Badge variant="secondary">{item.type}</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.reason || 'Brak powodu odrzucenia'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {item.price ? (
                            <span className="font-semibold">
                              {Number(item.price).toFixed(2)} {item.currency || 'PLN'}
                            </span>
                          ) : (
                            <span className="font-semibold">—</span>
                          )}
                          {safeQuery && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span>Query: {safeQuery}</span>
                            </>
                          )}
                          {item.createdAt && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span>{new Date(item.createdAt).toLocaleString('pl-PL')}</span>
                            </>
                          )}
                        </div>
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                            Podgląd źródła
                          </a>
                        )}
                      </div>

                      {/* Actions column for single item */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={discardedSelection[item.id] || false}
                          onChange={(e) => {
                            setDiscardedSelection(prev => ({
                              ...prev,
                              [item.id]: e.target.checked
                            }));
                          }}
                          className="w-5 h-5 cursor-pointer"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-green-700 hover:bg-green-50"
                          onClick={async () => {
                            try {
                              const currentUser = auth.currentUser;
                              if (!currentUser) {
                                toast({ title: 'Błąd', description: 'Brak zalogowanego użytkownika', variant: 'destructive' });
                                return;
                              }
                              const token = await currentUser.getIdToken();
                              const res = await fetch('/api/admin/moderation/restore-discarded', {
                                method: 'POST',
                                headers: { 
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ 
                                  items: [{ id: item.id, type: 'product' }],
                                  targetStatus: 'pending'
                                })
                              });
                              const data = await res.json();
                              if (res.ok && data.success) {
                                toast({ title: 'Sukces', description: 'Przywrócono' });
                                await loadData();
                              } else {
                                toast({ title: 'Błąd', description: data.message, variant: 'destructive' });
                              }
                            } catch (error: any) {
                              toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
                            }
                          }}
                        >
                          ↩️
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-red-700 hover:bg-red-50"
                          onClick={async () => {
                            if (!window.confirm('Czy na pewno chcesz trwale usunąć ten element?')) return;
                            try {
                              const currentUser = auth.currentUser;
                              if (!currentUser) {
                                toast({ title: 'Błąd', description: 'Brak zalogowanego użytkownika', variant: 'destructive' });
                                return;
                              }
                              const token = await currentUser.getIdToken();
                              const res = await fetch('/api/admin/moderation/delete-discarded', {
                                method: 'POST',
                                headers: { 
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ ids: [item.id] })
                              });
                              const data = await res.json();
                              if (res.ok && data.success) {
                                toast({ title: 'Sukces', description: 'Usunięto' });
                                await loadData();
                              } else {
                                toast({ title: 'Błąd', description: data.message, variant: 'destructive' });
                              }
                            } catch (error: any) {
                              toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
                            }
                          }}
                        >
                          🗑️
                        </Button>
                      </div>
                          </>
                        );
                      })()}
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
                            Pod: {getLocalizedTitle(comment.parentTitle) || 'Nieznany tytuł'}
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
