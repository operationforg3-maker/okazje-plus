'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { useAuth } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { withImageProxy } from '@/lib/image-proxy';
import { ModerationDetailView } from '@/components/admin/moderation-detail-view';
import { BulkModerationBar } from '@/components/admin/moderation/bulk-moderation-bar';
import { ModerationFilters } from '@/components/admin/moderation/moderation-filters';
import { ModerationHistory } from '@/components/admin/moderation/moderation-history';
import { ForumModerationPanel } from '@/components/admin/moderation/forum-moderation-panel';
import { QuickEditDialog } from '@/components/admin/moderation/quick-edit-dialog';
import { getCategories } from '@/lib/data';
import {
  CheckSquare,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  Sparkles,
  Pencil,
  MessageSquare,
  History,
  ListChecks,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import DealCard from '@/components/deal-card';
import ProductListCard from '@/components/product-list-card';
import type { Deal, Product, Category } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLocalizedTitle(value: unknown): string {
  if (!value) return 'Bez tytułu';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as Record<string, string>;
    return v.pl || v.en || v.de || Object.values(v)[0] || 'Bez tytułu';
  }
  return 'Bez tytułu';
}

function formatDate(dateString: string) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('pl-PL', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'approved') return 'default';
  if (status === 'pending' || status === 'pending_approval') return 'secondary';
  if (status === 'draft' || status === 'poczekalnia') return 'outline';
  return 'destructive';
}

function getPrice(product: Product): string {
  const p = product.price as unknown;
  if (!p) return '—';
  if (typeof p === 'number') return `${p.toFixed(2)} zł`;
  if (typeof p === 'object') {
    const po = p as { amount?: number; current?: number };
    const amount = po.amount ?? po.current;
    if (amount !== undefined) return `${Number(amount).toFixed(2)} zł`;
  }
  return '—';
}

// ─── Discarded Tab (extracted to keep JSX readable) ──────────────────────────

function DiscardedTab({
  items,
  totalCount = 0,
  getToken,
  onReload,
}: {
  items: unknown[];
  totalCount?: number;
  getToken: () => Promise<string | null>;
  onReload: () => void;
}) {
  const { toast } = useToast();
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState(false);

  const selectedIds = Object.entries(selection)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const doAction = async (endpoint: string, body: unknown) => {
    const token = await getToken();
    if (!token) return;
    setProcessing(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success?: boolean; message?: string; processed?: number; total?: number };
      if (res.ok && data.success) {
        toast({ title: 'Sukces', description: `Przetworzono ${data.processed ?? 0}/${data.total ?? 0}` });
        setSelection({});
        onReload();
      } else {
        toast({ title: 'Błąd', description: data.message || 'Nie udało się', variant: 'destructive' });
      }
    } catch (err: unknown) {
      toast({ title: 'Błąd sieciowy', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Brak odfiltrowanych importów</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="border rounded-md p-3 bg-muted/30 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">
            {selectedIds.length} / {totalCount || items.length} w bazie
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" disabled={processing}
              onClick={() => {
                if (window.confirm(`Zaznaczyć wszystkie ${totalCount || items.length} elementów w bazie? Akcja wykona się na wszystkich elementach (nie tylko tych na liście).`)) {
                  setSelection({ __ALL__: true });
                }
              }}>
              Zaznacz całą bazę ({totalCount || items.length})
            </Button>
            <Button size="sm" variant="outline" disabled={processing}
              onClick={() => {
                const visible: Record<string, boolean> = {};
                (items as Array<{ id: string }>).forEach(item => { visible[item.id] = true; });
                setSelection(visible);
              }}>
              Zaznacz widoczne
            </Button>
            <Button size="sm" variant="outline" disabled={processing || (selectedIds.length === 0 && !selection['__ALL__'])}
              onClick={() => setSelection({})}>
              Wyczyść
            </Button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className="bg-green-600 hover:bg-green-700"
            disabled={processing || (selectedIds.length === 0 && !selection['__ALL__'])}
            onClick={() => {
              if (selection['__ALL__']) {
                doAction('/api/admin/moderation/restore-discarded', { mode: 'all', targetStatus: 'pending' });
              } else {
                doAction('/api/admin/moderation/restore-discarded', {
                  items: selectedIds.map(id => ({ id, type: 'product' })),
                  targetStatus: 'pending',
                });
              }
            }}>
            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            ↩️ Przywróć zaznaczone
          </Button>
          <Button size="sm" variant="destructive"
            disabled={processing || (selectedIds.length === 0 && !selection['__ALL__'])}
            onClick={() => {
              const count = selection['__ALL__'] ? (totalCount || items.length) : selectedIds.length;
              if (window.confirm(`Trwale usunąć ${count} elementów?`)) {
                if (selection['__ALL__']) {
                  doAction('/api/admin/moderation/delete-discarded', { mode: 'all' });
                } else {
                  doAction('/api/admin/moderation/delete-discarded', { ids: selectedIds });
                }
              }
            }}>
            🗑️ Usuń zaznaczone
          </Button>
        </div>
      </div>

      {/* List */}
      {(items as Array<Record<string, unknown>>).map(item => {
        const id = String(item.id || '');
        const title = getLocalizedTitle(item.title || item.name);
        const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl : 
                         typeof item.image === 'string' ? item.image :
                         Array.isArray(item.gallery) && item.gallery[0]?.url ? item.gallery[0].url : 
                         Array.isArray(item.images) && typeof item.images[0] === 'string' ? item.images[0] : '';
        return (
          <div key={id} className="flex flex-col sm:flex-row items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors">
            <input
              type="checkbox"
              checked={selection[id] || selection['__ALL__'] || false}
              onChange={e => {
                if (selection['__ALL__']) {
                  // If unchecking one while ALL is selected, we should probably clear ALL
                  setSelection(prev => {
                    const next = { ...prev };
                    delete next['__ALL__'];
                    next[id] = e.target.checked;
                    return next;
                  });
                } else {
                  setSelection(prev => ({ ...prev, [id]: e.target.checked }));
                }
              }}
              className="w-5 h-5 cursor-pointer mt-1 shrink-0"
            />
            {imageUrl && (
              <div className="w-16 h-16 bg-muted rounded overflow-hidden border shrink-0">
                <img src={withImageProxy(imageUrl)} className="w-full h-full object-cover" alt="" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate" title={title}>{title || 'Bez tytułu'}</h3>
              <p className="text-xs text-muted-foreground">{String(item.reason || item.type || '—')}</p>
              {item.createdAt && (
                <p className="text-xs text-muted-foreground">{new Date(String(item.createdAt)).toLocaleString('pl-PL')}</p>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-xs text-green-700"
                onClick={() => doAction('/api/admin/moderation/restore-discarded', {
                  items: [{ id, type: 'product' }], targetStatus: 'pending',
                })}>
                ↩️
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-red-700"
                onClick={() => {
                  if (window.confirm('Usunąć?'))
                    doAction('/api/admin/moderation/delete-discarded', { ids: [id] });
                }}>
                🗑️
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Comments Tab ─────────────────────────────────────────────────────────────

function CommentsTab({
  getToken,
}: { getToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [comments, setComments] = useState<ReportedComment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/comments/moderate?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { comments?: ReportedComment[] };
      if (res.ok) setComments(data.comments || []);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const moderateComment = async (
    commentId: string,
    parentType: 'deal' | 'product',
    parentId: string,
    action: 'approve' | 'reject' | 'delete' | 'mark-spam',
  ) => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch('/api/admin/comments/moderate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, parentType, parentId, action }),
    });
    const data = await res.json() as { success?: boolean; message?: string; error?: string };
    if (res.ok && data.success) {
      toast({ title: 'Sukces', description: data.message || 'Wykonano' });
      fetchComments();
    } else {
      toast({ title: 'Błąd', description: data.error || 'Nie udało się', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Zgłoszone komentarze</CardTitle>
            <CardDescription>Komentarze oznaczone jako spam lub zgłoszone przez użytkowników</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchComments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}</div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Brak zgłoszonych komentarzy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map(comment => (
              <div key={comment.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="destructive" className="text-xs">{comment.reportCount} zgłoszeń</Badge>
                  <Badge variant="outline" className="text-xs">{comment.parentType === 'deal' ? 'Okazja' : 'Produkt'}</Badge>
                  {comment.status && <Badge variant="secondary" className="text-xs">{comment.status}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pod: <span className="font-medium">{getLocalizedTitle(comment.parentTitle)}</span>
                  {' · '}{formatDate(comment.createdAt)}
                </p>
                <div className="bg-muted rounded px-2 py-1.5">
                  <p className="text-sm">{comment.content}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="default" className="h-7 text-xs"
                    onClick={() => moderateComment(comment.id, comment.parentType, comment.parentId, 'approve')}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />Zatwierdź
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => moderateComment(comment.id, comment.parentType, comment.parentId, 'reject')}>
                    Odrzuć
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-xs"
                    onClick={() => {
                      if (window.confirm('Usunąć komentarz?'))
                        moderateComment(comment.id, comment.parentType, comment.parentId, 'delete');
                    }}>
                    <XCircle className="h-3.5 w-3.5 mr-1" />Usuń
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-xs bg-red-950 text-red-50"
                    onClick={() => {
                      if (window.confirm('Oznaczyć jako spam?'))
                        moderateComment(comment.id, comment.parentType, comment.parentId, 'mark-spam');
                    }}>
                    🚫 Spam
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ModerationPage() {
  const { getIdToken } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pendingDeals, setPendingDeals] = useState<Deal[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [approvedItems, setApprovedItems] = useState<unknown[]>([]);
  const [rejectedItems, setRejectedItems] = useState<unknown[]>([]);
  const [discardedItems, setDiscardedItems] = useState<unknown[]>([]);
  const [discardedCount, setDiscardedCount] = useState<number>(0);
  const [totalDealsCount, setTotalDealsCount] = useState<number>(0);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);

  // Filters
  const [dealStatusFilter, setDealStatusFilter] = useState('pending');
  const [productStatusFilter, setProductStatusFilter] = useState('pending');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedSubSubCategory, setSelectedSubSubCategory] = useState('');

  // Quick edit dialog
  const [quickEditItem, setQuickEditItem] = useState<Deal | Product | null>(null);
  const [quickEditType, setQuickEditType] = useState<'deal' | 'product'>('deal');

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchModerationData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) { setLoading(false); return; }

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

      const qs = new URLSearchParams();
      if (dealStatuses) qs.set('dealStatuses', dealStatuses.join(','));
      if (productStatuses) qs.set('productStatuses', productStatuses.join(','));
      qs.set('limit', '200');
      qs.set('includeRecent', '1');

      const res = await fetch(`/api/admin/moderation/data?${qs}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) { setLoading(false); return; }

      const payload = await res.json() as {
        deals?: Deal[]; products?: Product[];
        approved?: unknown[]; rejected?: unknown[]; discarded?: unknown[];
        discardedCount?: number;
        totalDealsCount?: number;
        totalProductsCount?: number;
      };

      let deals = payload.deals || [];
      let products = payload.products || [];

      if (selectedMainCategory) {
        deals = deals.filter(d => (d as unknown as Record<string, string>).mainCategorySlug === selectedMainCategory);
        products = products.filter(p => (p as unknown as Record<string, string>).mainCategorySlug === selectedMainCategory);
      }
      if (selectedSubCategory) {
        deals = deals.filter(d => (d as unknown as Record<string, string>).subCategorySlug === selectedSubCategory);
        products = products.filter(p => (p as unknown as Record<string, string>).subCategorySlug === selectedSubCategory);
      }
      if (selectedSubSubCategory) {
        deals = deals.filter(d => (d as unknown as Record<string, string>).subSubCategorySlug === selectedSubSubCategory);
        products = products.filter(p => (p as unknown as Record<string, string>).subSubCategorySlug === selectedSubSubCategory);
      }

      setPendingDeals(deals);
      setPendingProducts(products);
      setApprovedItems(payload.approved || []);
      setRejectedItems(payload.rejected || []);
      setDiscardedItems(payload.discarded || []);
      setDiscardedCount(payload.discardedCount || 0);
      setTotalDealsCount(payload.totalDealsCount || 0);
      setTotalProductsCount(payload.totalProductsCount || 0);
    } catch (err) {
      console.error('[Moderation] fetch error:', err);
      toast({ title: 'Błąd', description: 'Nie udało się pobrać danych', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [getIdToken, toast, dealStatusFilter, productStatusFilter, selectedMainCategory, selectedSubCategory, selectedSubSubCategory]);

  useEffect(() => { fetchModerationData(); }, [fetchModerationData]);
  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleModeration = async (
    itemId: string,
    itemType: 'deal' | 'product',
    action: 'approve' | 'reject',
  ) => {
    setProcessingId(itemId);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, itemType, action }),
      });
      const data = await res.json() as { success?: boolean; message?: string };
      if (data.success) {
        toast({ title: 'Sukces', description: data.message });
        await fetchModerationData();
      } else {
        throw new Error(data.message || 'Błąd');
      }
    } catch (err: unknown) {
      toast({ title: 'Błąd', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleBackfill = async () => {
    const token = await getIdToken();
    if (!token) return;
    setIsBackfilling(true);
    try {
      const res = await fetch('/api/admin/moderation/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dryRun: false, approvedOnly: true, maxScanPerCollection: 10000, maxProcessPerType: 400 }),
      });
      const data = await res.json() as { success?: boolean; error?: string; message?: string; processed?: { deals?: number; products?: number }; missing?: { deals?: number; products?: number }; hasMore?: { deals?: boolean; products?: boolean } };
      if (!res.ok || !data.success) throw new Error(data.error || data.message || 'Błąd');
      const hasMore = data.hasMore?.deals || data.hasMore?.products;
      toast({
        title: 'Backfill uruchomiony',
        description: `Deale: ${data.processed?.deals ?? 0}/${data.missing?.deals ?? 0}, Produkty: ${data.processed?.products ?? 0}/${data.missing?.products ?? 0}${hasMore ? ' — uruchom ponownie' : ''}`,
        duration: 9000,
      });
      await fetchModerationData();
    } catch (err: unknown) {
      toast({ title: 'Błąd backfillu', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsBackfilling(false);
    }
  };

  // ── Common action buttons component ─────────────────────────────────────────

  const ModerationActions = ({
    item, type,
  }: { item: Deal | Product; type: 'deal' | 'product' }) => (
    <div className="flex flex-wrap items-center gap-2">
      {/* Full preview dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={processingId === item.id}>
            <Eye className="h-4 w-4 mr-1" />Podgląd
          </Button>
        </DialogTrigger>
        <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate">
              {type === 'deal' ? 'Deal' : 'Produkt'}: {getLocalizedTitle((item as Deal).title || (item as Product).name)}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <ModerationDetailView item={item} itemType={type} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick edit + approve */}
      <Button
        variant="outline" size="sm"
        disabled={processingId === item.id}
        onClick={() => {
          setQuickEditItem(item);
          setQuickEditType(type);
        }}
      >
        <Pencil className="h-4 w-4 mr-1" />Edytuj
      </Button>

      <Button variant="destructive" size="sm"
        disabled={processingId === item.id}
        onClick={() => handleModeration(item.id, type, 'reject')}>
        <XCircle className="h-4 w-4 mr-1" />Odrzuć
      </Button>
      <Button variant="default" size="sm"
        disabled={processingId === item.id}
        onClick={() => handleModeration(item.id, type, 'approve')}>
        {processingId === item.id
          ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          : <CheckCircle className="h-4 w-4 mr-1" />}
        Zatwierdź
      </Button>
    </div>
  );

  // ── Stats ────────────────────────────────────────────────────────────────────

  const totalPending = totalDealsCount + totalProductsCount;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Panel moderacji</h2>
          <p className="text-muted-foreground">Zatwierdzaj, odrzucaj i zarządzaj treściami</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleBackfill} disabled={isBackfilling}>
            <Sparkles className={`h-4 w-4 mr-2 ${isBackfilling ? 'animate-pulse' : ''}`} />
            {isBackfilling ? 'Backfill...' : 'Backfill braków'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchModerationData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Do moderacji', value: totalPending, icon: <Clock className="h-4 w-4 text-muted-foreground" />, sub: 'Oczekuje na akcję' },
          { label: 'Okazje', value: totalDealsCount, icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, sub: 'Do zatwierdzenia' },
          { label: 'Produkty', value: totalProductsCount, icon: <ListChecks className="h-4 w-4 text-blue-500" />, sub: 'Do zatwierdzenia' },
          { label: 'Odfiltrowane', value: discardedCount, icon: <XCircle className="h-4 w-4 text-red-400" />, sub: 'Import discarded' },
        ].map(({ label, value, icon, sub }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              {icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Skeleton className="h-8 w-16" /> : value}
              </div>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="deals" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="deals">
            Okazje
            {totalDealsCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 h-4">{totalDealsCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="products">
            Produkty
            {totalProductsCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 h-4">{totalProductsCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="comments">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Komentarze
          </TabsTrigger>
          <TabsTrigger value="forum">Forum</TabsTrigger>
          <TabsTrigger value="discarded">
            Odfiltrowane
            {discardedCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 h-4">{discardedCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-3.5 w-3.5 mr-1.5" />Historia
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Deals ─────────────────────────────────────────────────────── */}
        <TabsContent value="deals" className="space-y-4">
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
          <BulkModerationBar type="deal" items={pendingDeals} onAction={fetchModerationData} />

          <Card>
            <CardHeader>
              <CardTitle>Okazje do moderacji</CardTitle>
              <CardDescription>Deale ze statusem: {dealStatusFilter}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : pendingDeals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak okazji do moderacji</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDeals.map(deal => (
                    <div key={deal.id} className="flex flex-col lg:flex-row items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors">
                      <div className="w-full lg:w-[300px] lg:shrink-0">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <DealCard deal={deal as any} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold truncate">{getLocalizedTitle((deal as Deal).title)}</h3>
                          <Badge variant={statusVariant(deal.status || '')}>{deal.status}</Badge>
                          {(deal as unknown as Record<string, unknown>).source && (
                            <Badge variant="outline" className="text-xs">
                              {String((deal as unknown as Record<string, unknown>).source) === 'api' ? '🤖 API' : '👤 Manual'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getLocalizedTitle((deal as unknown as Record<string, unknown>).category)}
                          {' · '}
                          {String((deal as unknown as Record<string, unknown>).postedBy || (deal as unknown as Record<string, unknown>).createdBy || 'Użytkownik')}
                          {' · '}
                          {formatDate(String((deal as unknown as Record<string, unknown>).postedAt || ''))}
                        </p>
                        <ModerationActions item={deal} type="deal" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Products ────────────────────────────────────────────────── */}
        <TabsContent value="products" className="space-y-4">
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
          <BulkModerationBar type="product" items={pendingProducts} onAction={fetchModerationData} />

          <Card>
            <CardHeader>
              <CardTitle>Produkty do moderacji</CardTitle>
              <CardDescription>ProductCores ze statusem: {productStatusFilter}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : pendingProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak produktów do moderacji</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingProducts.map(product => {
                    const title = getLocalizedTitle((product as unknown as Record<string, unknown>).title || (product as unknown as Record<string, unknown>).name);
                    return (
                      <div key={product.id} className="flex flex-col lg:flex-row items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors">
                        <div className="w-full lg:w-[300px] lg:shrink-0">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <ProductListCard product={product as any} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate" title={title}>{title}</h3>
                            <Badge variant={statusVariant(product.status || '')}>{product.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {getLocalizedTitle((product as unknown as Record<string, unknown>).category)}
                            {' · '}{getPrice(product)}
                          </p>
                          <ModerationActions item={product} type="product" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Comments ─────────────────────────────────────────────────── */}
        <TabsContent value="comments">
          <CommentsTab getToken={getIdToken} />
        </TabsContent>

        {/* ── Tab: Forum ────────────────────────────────────────────────────── */}
        <TabsContent value="forum">
          <ForumModerationPanel />
        </TabsContent>

        {/* ── Tab: Discarded ────────────────────────────────────────────────── */}
        <TabsContent value="discarded" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Odfiltrowane importy</CardTitle>
              <CardDescription>
                Pozycje odrzucone przez filtr jakości — możesz je przywrócić lub trwale usunąć.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiscardedTab
                items={discardedItems}
                totalCount={discardedCount}
                onReload={fetchModerationData}
                getToken={getIdToken}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: History ──────────────────────────────────────────────────── */}
        <TabsContent value="history">
          <ModerationHistory />
        </TabsContent>
      </Tabs>

      {/* Quick Edit Dialog */}
      {quickEditItem && (
        <QuickEditDialog
          open={!!quickEditItem}
          onClose={() => setQuickEditItem(null)}
          item={quickEditItem as Parameters<typeof QuickEditDialog>[0]['item']}
          itemType={quickEditType}
          onSuccess={fetchModerationData}
        />
      )}
    </div>
  );
}

export default withAuth(ModerationPage);
