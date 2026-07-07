'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScrapingItem {
  id: string;
  title: string;
  aliExpressId: string | null;
  scrapingStatus: 'pending' | 'running' | 'done' | 'failed';
  scrapingAttempts: number;
  lastError: string | null;
  captchaEncountered: boolean;
  reviewsCount: number;
  scrapedAt: string | null;
  updatedAt: string | null;
  imageUrl: string | null;
}

interface ScrapingCounts {
  pending: number;
  running: number;
  failed: number;
  done: number;
}

const STATUS_CONFIG = {
  pending: { label: 'Oczekuje', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', badge: 'secondary' as const },
  running: { label: 'W trakcie', icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20', badge: 'default' as const },
  done:    { label: 'Gotowe', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20', badge: 'default' as const },
  failed:  { label: 'Błąd', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20', badge: 'destructive' as const },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function ScrapingQueuePanel() {
  const { getIdToken } = useAuth();
  const [counts, setCounts] = useState<ScrapingCounts | null>(null);
  const [items, setItems] = useState<ScrapingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const [retryingAll, setRetryingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('pending,running,failed');

  const fetchQueue = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/scraping-queue?status=${activeFilter}&limit=100`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setCounts(data.counts);
        setItems(data.items || []);
      }
    } catch {
      toast.error('Błąd pobierania kolejki scrapingu');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, activeFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Auto-refresh when there are running items
  useEffect(() => {
    if (!counts || counts.running === 0) return;
    const interval = setInterval(fetchQueue, 10_000);
    return () => clearInterval(interval);
  }, [counts, fetchQueue]);

  const retryOne = async (productId: string) => {
    const token = await getIdToken();
    if (!token) return;
    setRetrying(prev => ({ ...prev, [productId]: true }));
    try {
      const res = await fetch('/api/admin/scraping-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Retry zaplanowany');
        fetchQueue();
      } else {
        toast.error(data.error || 'Błąd retry');
      }
    } catch {
      toast.error('Błąd połączenia');
    } finally {
      setRetrying(prev => ({ ...prev, [productId]: false }));
    }
  };

  const retryAll = async () => {
    const token = await getIdToken();
    if (!token) return;
    setRetryingAll(true);
    try {
      const res = await fetch('/api/admin/scraping-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ retryAll: true }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Retry zaplanowany dla ${data.updated} produktów`);
        fetchQueue();
      } else {
        toast.error(data.error || 'Błąd retry all');
      }
    } catch {
      toast.error('Błąd połączenia');
    } finally {
      setRetryingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['pending', 'running', 'failed', 'done'] as const).map(status => {
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          const count = counts?.[status] ?? '—';
          return (
            <Card
              key={status}
              className={`cursor-pointer transition-all border-2 ${activeFilter.includes(status) && activeFilter !== 'pending,running,failed' ? 'border-primary' : 'border-transparent'}`}
              onClick={() => setActiveFilter(status)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{cfg.label}</span>
                  <Icon className={`h-4 w-4 ${cfg.color} ${status === 'running' ? 'animate-spin' : ''}`} />
                </div>
                <div className={`text-2xl font-bold mt-1 ${cfg.color}`}>{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Kolejka scrapingu</CardTitle>
              <CardDescription>
                Produkty AliExpress oczekujące na pobranie danych (specyfikacje, recenzje, zdjęcia)
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchQueue}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Odśwież
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveFilter('pending,running,failed')}
                className={activeFilter === 'pending,running,failed' ? 'bg-muted' : ''}
              >
                Wszystkie aktywne
              </Button>
              {(counts?.failed ?? 0) > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={retryAll}
                  disabled={retryingAll}
                >
                  {retryingAll ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Retry wszystkich ({counts?.failed ?? 0})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              Ładowanie kolejki...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="font-medium">Kolejka pusta</p>
              <p className="text-sm">Brak produktów z tym statusem.</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map(item => {
                const cfg = STATUS_CONFIG[item.scrapingStatus];
                const Icon = cfg.icon;
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    {/* Status icon */}
                    <div className={`mt-0.5 shrink-0 rounded-full p-1.5 ${cfg.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.color} ${item.scrapingStatus === 'running' ? 'animate-spin' : ''}`} />
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        <Badge variant={cfg.badge} className="shrink-0 text-xs">
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {item.aliExpressId && (
                          <a
                            href={`https://pl.aliexpress.com/item/${item.aliExpressId}.html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {item.aliExpressId}
                          </a>
                        )}
                        {item.scrapingAttempts > 0 && (
                          <span>Próby: <b>{item.scrapingAttempts}</b></span>
                        )}
                        {item.reviewsCount > 0 && (
                          <span className="text-green-600">Recenzje: {item.reviewsCount}</span>
                        )}
                        {item.captchaEncountered && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" /> CAPTCHA
                          </span>
                        )}
                        {item.updatedAt && (
                          <span>{formatDate(item.updatedAt)}</span>
                        )}
                      </div>
                      {item.lastError && (
                        <p className="mt-1 text-xs text-red-600 truncate max-w-md" title={item.lastError}>
                          ⚠ {item.lastError}
                        </p>
                      )}
                    </div>

                    {/* Retry button — only for failed */}
                    {item.scrapingStatus === 'failed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 h-7 text-xs"
                        onClick={() => retryOne(item.id)}
                        disabled={retrying[item.id]}
                      >
                        {retrying[item.id] ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3 mr-1" />
                        )}
                        Retry
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
