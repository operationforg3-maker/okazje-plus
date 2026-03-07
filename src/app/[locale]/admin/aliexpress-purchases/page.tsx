'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { RefreshCcw, ShoppingBag, Coins, Wallet, Activity, Percent } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

type PurchaseRow = {
  id: string;
  transactionId: string;
  orderId: string | null;
  advertiser: string;
  status: string;
  purchaseAmount: number;
  commissionAmount: number;
  currency: string;
  purchaseDate: string;
  website: string | null;
  clickId: string | null;
};

type PurchasesResponse = {
  success: boolean;
  error?: string;
  remoteError?: string | null;
  source?: 'live' | 'firestore';
  purchases: PurchaseRow[];
  summary: {
    totalCount: number;
    totalPurchaseAmount: number;
    totalCommissionAmount: number;
    averageOrderValue: number;
    averageCommissionPerOrder: number;
    effectiveCommissionRate: number;
    primaryCurrency: string;
    statusBreakdown: Record<string, number>;
    purchases24h: number;
    purchases7d: number;
    commission24h: number;
    commission7d: number;
    withTrackingIdCount: number;
    trackingCoveragePercent: number;
    topTrackingIds: Array<{ id: string; count: number; commission: number; purchaseAmount: number }>;
  };
  filters?: {
    trackingId: string | null;
    availableTrackingIds: string[];
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  sync: {
    lastSyncAt: string | null;
    forceRefresh: boolean;
  };
};

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: currency || 'PLN',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const normalized = status.toLowerCase();
  if (normalized.includes('complete') || normalized.includes('approved') || normalized.includes('paid')) {
    return 'default';
  }
  if (normalized.includes('pending') || normalized.includes('processing')) {
    return 'secondary';
  }
  if (normalized.includes('reject') || normalized.includes('cancel') || normalized.includes('failed')) {
    return 'destructive';
  }
  return 'outline';
}

export default function AliExpressPurchasesAdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [response, setResponse] = useState<PurchasesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [trackingId, setTrackingId] = useState<string>('all');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);

  const fetchPurchases = async (
    forceRefresh = false,
    targetPage = page,
    targetPageSize = pageSize,
    targetTrackingId = trackingId
  ) => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(targetPageSize),
      });
      if (targetTrackingId !== 'all') {
        params.set('trackingId', targetTrackingId);
      }
      if (forceRefresh) {
        params.set('forceRefresh', '1');
      }

      const apiResponse = await fetch(`/api/admin/convertiser/purchases?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await apiResponse.json()) as PurchasesResponse;

      if (!apiResponse.ok || !payload.success) {
        throw new Error(payload.error || 'Nie udało się pobrać danych zakupowych');
      }

      setResponse(payload);
      if (payload.remoteError) {
        toast({
          title: 'Uwaga',
          description: `Nie udało się odświeżyć danych na żywo z AliExpress API. Pokazuję zapisane dane. (${payload.remoteError})`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Błąd',
        description: (error as Error).message || 'Błąd podczas pobierania zakupów afiliacyjnych',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }
      await fetchPurchases(true, page, pageSize);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importCsv = async () => {
    if (!csvFile) {
      toast({
        title: 'Brak pliku',
        description: 'Wybierz plik CSV z raportem afiliacyjnym.',
        variant: 'destructive',
      });
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      toast({
        title: 'Brak autoryzacji',
        description: 'Zaloguj się jako administrator.',
        variant: 'destructive',
      });
      return;
    }

    setImportingCsv(true);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch('/api/admin/convertiser/purchases', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Import CSV nie powiódł się');
      }

      toast({
        title: 'Import zakończony',
        description: `Zaimportowano ${payload.imported || 0} rekordów z CSV.`,
      });

      setCsvFile(null);
      await fetchPurchases(false, 1, pageSize, trackingId);
    } catch (error) {
      toast({
        title: 'Błąd importu CSV',
        description: (error as Error).message || 'Nie udało się zaimportować pliku CSV',
        variant: 'destructive',
      });
    } finally {
      setImportingCsv(false);
    }
  };

  const canGoPrev = page > 1;
  const canGoNext = page < (response?.pagination.totalPages || 1);
  const summaryCurrency = response?.summary.primaryCurrency || 'PLN';
  const availableTrackingIds = response?.filters?.availableTrackingIds || [];

  const statusSummary = useMemo(() => {
    const entries = Object.entries(response?.summary.statusBreakdown || {});
    return entries.sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [response?.summary.statusBreakdown]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zakupy afiliacyjne AliExpress</h1>
          <p className="text-muted-foreground mt-1">
            Realne transakcje zakupowe z naszych linków afiliacyjnych (AliExpress API).
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <Input
            type="file"
            accept=".csv,text/csv"
            className="w-full md:w-[260px]"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setCsvFile(file);
            }}
          />
          <Button onClick={importCsv} disabled={importingCsv} variant="outline">
            {importingCsv ? 'Importuję CSV...' : 'Importuj CSV'}
          </Button>
          <Select
            value={trackingId}
            onValueChange={async (value) => {
              setTrackingId(value);
              setPage(1);
              await fetchPurchases(false, 1, pageSize, value);
            }}
          >
            <SelectTrigger className="w-full md:w-[260px]">
              <SelectValue placeholder="Wybierz tracking ID" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie tracking ID</SelectItem>
              {availableTrackingIds.map((id) => (
                <SelectItem key={id} value={id}>{id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => fetchPurchases(true, page, pageSize, trackingId)} disabled={refreshing}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Odświeżam...' : 'Odśwież dane na żywo'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Liczba zakupów</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-20" /> : (response?.pagination.total || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Łączna wartość zakupów</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-28" /> : formatMoney(response?.summary.totalPurchaseAmount || 0, summaryCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Łączna prowizja</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Coins className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-28" /> : formatMoney(response?.summary.totalCommissionAmount || 0, summaryCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Ostatnia synchronizacja: {response?.sync.lastSyncAt ? formatDate(response.sync.lastSyncAt) : 'brak'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Średnia wartość koszyka</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-28" /> : formatMoney(response?.summary.averageOrderValue || 0, summaryCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Średnia prowizja / zakup</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Coins className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-28" /> : formatMoney(response?.summary.averageCommissionPerOrder || 0, summaryCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Efektywna stopa prowizji</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Percent className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-20" /> : `${(response?.summary.effectiveCommissionRate || 0).toFixed(2)}%`}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Zakupy (24h)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-16" /> : (response?.summary.purchases24h || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Zakupy (7 dni)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-16" /> : (response?.summary.purchases7d || 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prowizja (24h)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Coins className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-28" /> : formatMoney(response?.summary.commission24h || 0, summaryCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prowizja (7 dni)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Coins className="h-5 w-5" />
              {loading ? <Skeleton className="h-8 w-28" /> : formatMoney(response?.summary.commission7d || 0, summaryCurrency)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statusy transakcji</CardTitle>
          <CardDescription>Najczęstsze statusy wykryte w danych zakupowych.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {loading ? (
            <Skeleton className="h-8 w-56" />
          ) : statusSummary.length ? (
            statusSummary.map(([status, count]) => (
              <Badge key={status} variant={getStatusVariant(status)}>
                {status}: {count}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Brak danych statusów.</span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Najlepsze tracking ID (wg prowizji)</CardTitle>
          <CardDescription>Najbardziej dochodowe identyfikatory śledzenia w aktualnym widoku.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Skeleton className="h-8 w-72" />
          ) : response?.summary.topTrackingIds?.length ? (
            response.summary.topTrackingIds.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <div className="font-mono truncate">{item.id}</div>
                  <div className="text-xs text-muted-foreground">Zakupy: {item.count}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatMoney(item.commission, summaryCurrency)}</div>
                  <div className="text-xs text-muted-foreground">Wartość: {formatMoney(item.purchaseAmount, summaryCurrency)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">Brak tracking ID w danych.</div>
          )}
          {!loading && (
            <div className="text-xs text-muted-foreground pt-1">
              Pokrycie tracking ID: {(response?.summary.trackingCoveragePercent || 0).toFixed(1)}% ({response?.summary.withTrackingIdCount || 0}/{response?.summary.totalCount || 0})
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista zakupów</CardTitle>
          <CardDescription>
            Źródło danych: {response?.source === 'live' ? 'odświeżenie na żywo (AliExpress API)' : 'zapisane dane (Firestore / CSV)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Reklamodawca</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Kwota zakupu</TableHead>
                    <TableHead>Prowizja</TableHead>
                    <TableHead>Tracking ID</TableHead>
                    <TableHead>ID zamówienia</TableHead>
                    <TableHead>ID transakcji</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(response?.purchases || []).map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>{formatDate(purchase.purchaseDate)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{purchase.advertiser || 'AliExpress'}</div>
                        {purchase.website && (
                          <div className="text-xs text-muted-foreground">{purchase.website}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(purchase.status)}>{purchase.status || 'unknown'}</Badge>
                      </TableCell>
                      <TableCell>{formatMoney(purchase.purchaseAmount, purchase.currency)}</TableCell>
                      <TableCell>{formatMoney(purchase.commissionAmount, purchase.currency)}</TableCell>
                      <TableCell className="font-mono text-xs">{purchase.clickId || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{purchase.orderId || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{purchase.transactionId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {!response?.purchases?.length && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Brak transakcji do wyświetlenia.
                </div>
              )}

              {!!response && (
                <PaginationControls
                  currentPage={response.pagination.page}
                  totalPages={response.pagination.totalPages}
                  totalItems={response.pagination.total}
                  itemsPerPage={response.pagination.pageSize}
                  canGoPrev={canGoPrev}
                  canGoNext={canGoNext}
                  onPageChange={async (targetPage) => {
                    setPage(targetPage);
                    await fetchPurchases(false, targetPage, pageSize, trackingId);
                  }}
                  onFirstPage={async () => {
                    setPage(1);
                    await fetchPurchases(false, 1, pageSize, trackingId);
                  }}
                  onLastPage={async () => {
                    const lastPage = response.pagination.totalPages;
                    setPage(lastPage);
                    await fetchPurchases(false, lastPage, pageSize, trackingId);
                  }}
                  onPrevPage={async () => {
                    const targetPage = Math.max(1, page - 1);
                    setPage(targetPage);
                    await fetchPurchases(false, targetPage, pageSize, trackingId);
                  }}
                  onNextPage={async () => {
                    const targetPage = Math.min(response.pagination.totalPages, page + 1);
                    setPage(targetPage);
                    await fetchPurchases(false, targetPage, pageSize, trackingId);
                  }}
                  onItemsPerPageChange={async (value) => {
                    setPageSize(value);
                    setPage(1);
                    await fetchPurchases(false, 1, value, trackingId);
                  }}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
