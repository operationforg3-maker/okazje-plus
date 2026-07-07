'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle,
  XCircle,
  Pin,
  Lock,
  Unlock,
  Trash2,
  AlertTriangle,
  MessageSquare,
  FileText,
  RefreshCw,
  Loader2,
  PinOff,
} from 'lucide-react';
import { toast } from 'sonner';

type ForumItem = {
  type: 'thread' | 'post';
  id: string;
  title?: string;
  content?: string;
  authorDisplayName?: string;
  authorId?: string | null;
  status?: string;
  createdAt: string;
  isPinned?: boolean;
  isLocked?: boolean;
  reportCount?: number;
  postCount?: number;
  threadId?: string | null;
  categorySlug?: string | null;
};

type FilterType = 'pending' | 'reported' | 'all';

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    approved: { label: 'Zatwierdzone', variant: 'default' },
    pending: { label: 'Oczekuje', variant: 'secondary' },
    draft: { label: 'Szkic', variant: 'outline' },
    rejected: { label: 'Odrzucone', variant: 'destructive' },
    deleted: { label: 'Usunięte', variant: 'destructive' },
    spam: { label: 'Spam', variant: 'destructive' },
  };
  const cfg = map[status || ''] ?? { label: status || '?', variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function ForumModerationPanel() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState<ForumItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});

  const loadItems = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/forum/moderate?filter=${filter}&limit=50`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setItems(data.items || []);
        setCounts(data.counts || {});
      } else {
        toast.error(data.error || 'Błąd ładowania');
      }
    } catch {
      toast.error('Błąd połączenia');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, filter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const moderate = async (item: ForumItem, action: string) => {
    const token = await getIdToken();
    if (!token) return;
    setProcessingId(item.id);
    try {
      const res = await fetch('/api/admin/forum/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action,
          targetType: item.type,
          targetId: item.id,
          reason: reasonMap[item.id] || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Akcja wykonana');
        setReasonMap(prev => { const n = { ...prev }; delete n[item.id]; return n; });
        await loadItems();
      } else {
        toast.error(data.error || 'Błąd akcji');
      }
    } catch {
      toast.error('Błąd połączenia');
    } finally {
      setProcessingId(null);
    }
  };

  const filterButtons: { value: FilterType; label: string; count?: number }[] = [
    { value: 'pending', label: 'Oczekujące', count: counts.pending },
    { value: 'reported', label: 'Zgłoszone', count: counts.reported },
    { value: 'all', label: 'Wszystkie', count: counts.total },
  ];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterButtons.map(f => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            {f.count !== undefined && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] py-0 h-4">
                {f.count}
              </Badge>
            )}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={loadItems} disabled={loading} className="ml-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Forum — wątki i posty</CardTitle>
          <CardDescription>
            Moderacja przez Admin SDK — paginacja 50 elementów
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ładowanie...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Brak elementów do moderacji.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.id}
                  className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="shrink-0 mt-0.5">
                      {item.type === 'thread'
                        ? <FileText className="h-4 w-4 text-blue-500" />
                        : <MessageSquare className="h-4 w-4 text-violet-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title || '(Post)'}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] h-4 py-0">
                          {item.type === 'thread' ? 'Wątek' : 'Post'}
                        </Badge>
                        <StatusBadge status={item.status} />
                        {item.isPinned && (
                          <Badge variant="secondary" className="text-[10px] h-4 py-0">📌 Przypięty</Badge>
                        )}
                        {item.isLocked && (
                          <Badge variant="secondary" className="text-[10px] h-4 py-0">🔒 Zablokowany</Badge>
                        )}
                        {(item.reportCount ?? 0) > 0 && (
                          <Badge variant="destructive" className="text-[10px] h-4 py-0 gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {item.reportCount} zgłoszeń
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.authorDisplayName} · {formatDate(item.createdAt)}
                        {item.type === 'thread' && item.postCount !== undefined && (
                          <> · {item.postCount} postów</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Content preview */}
                  {item.content && (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5 line-clamp-2">
                      {item.content}
                    </p>
                  )}

                  {/* Reason input (optional) */}
                  <Textarea
                    placeholder="Powód (opcjonalnie)..."
                    value={reasonMap[item.id] || ''}
                    onChange={e => setReasonMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                    className="h-8 min-h-[32px] text-xs resize-none py-1.5"
                  />

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {['pending', 'draft'].includes(item.status || '') && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        disabled={processingId === item.id}
                        onClick={() => moderate(item, 'approve')}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Zatwierdź
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      disabled={processingId === item.id}
                      onClick={() => moderate(item, 'reject')}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Odrzuć
                    </Button>
                    {item.type === 'thread' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={processingId === item.id}
                          onClick={() => moderate(item, item.isPinned ? 'unpin' : 'pin')}
                        >
                          {item.isPinned
                            ? <><PinOff className="h-3.5 w-3.5 mr-1" />Odepnij</>
                            : <><Pin className="h-3.5 w-3.5 mr-1" />Przypnij</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={processingId === item.id}
                          onClick={() => moderate(item, item.isLocked ? 'unlock' : 'lock')}
                        >
                          {item.isLocked
                            ? <><Unlock className="h-3.5 w-3.5 mr-1" />Odblokuj</>
                            : <><Lock className="h-3.5 w-3.5 mr-1" />Zablokuj</>}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={processingId === item.id}
                      onClick={() => moderate(item, 'spam')}
                    >
                      ⚡ Spam
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={processingId === item.id}
                      onClick={() => {
                        if (window.confirm('Usunąć?')) moderate(item, 'delete');
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Usuń
                    </Button>
                    {processingId === item.id && (
                      <Loader2 className="h-4 w-4 animate-spin mt-1.5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
