'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  User,
  Clock,
  Filter,
} from 'lucide-react';

interface LogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  moderatorId?: string;
  moderatorEmail?: string;
  timestamp: string;
  metadata?: { previousStatus?: string };
}

interface Stats {
  total: number;
  approved: number;
  rejected: number;
  deals: number;
  products: number;
}

function formatDateTime(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function ModerationHistory() {
  const { getIdToken } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState('7');
  const [actionFilter, setActionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchLogs = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', days });
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (typeFilter !== 'all') params.set('targetType', typeFilter);

      const res = await fetch(`/api/admin/moderation/logs?${params}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setLogs(data.logs || []);
        setStats(data.stats || null);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [getIdToken, days, actionFilter, typeFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Łącznie', value: stats.total, color: 'text-foreground' },
            { label: 'Zatwierdzeń', value: stats.approved, color: 'text-green-600' },
            { label: 'Odrzuceń', value: stats.rejected, color: 'text-red-600' },
            { label: 'Dealów', value: stats.deals, color: 'text-blue-600' },
            { label: 'Produktów', value: stats.products, color: 'text-violet-600' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-3 pb-2">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">Historia akcji moderacji</CardTitle>
              <CardDescription>
                Logi z kolekcji <code>moderation_log</code>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Days filter */}
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Dziś</SelectItem>
                  <SelectItem value="7">7 dni</SelectItem>
                  <SelectItem value="30">30 dni</SelectItem>
                  <SelectItem value="90">90 dni</SelectItem>
                </SelectContent>
              </Select>
              {/* Action filter */}
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-8 w-[130px]">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie akcje</SelectItem>
                  <SelectItem value="approve">Zatwierdził</SelectItem>
                  <SelectItem value="reject">Odrzucił</SelectItem>
                </SelectContent>
              </Select>
              {/* Type filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie typy</SelectItem>
                  <SelectItem value="deal">Okazje</SelectItem>
                  <SelectItem value="product">Produkty</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="h-8">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ładowanie historii...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Brak wpisów w wybranym okresie.
            </div>
          ) : (
            <div className="divide-y text-sm">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 py-2.5 hover:bg-muted/40 px-1 rounded-sm transition-colors">
                  {/* Action icon */}
                  {log.action === 'approve' ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  )}

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={log.action === 'approve' ? 'default' : 'destructive'}
                        className="text-[10px] py-0 h-4"
                      >
                        {log.action === 'approve' ? 'Zatwierdził' : 'Odrzucił'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        {log.targetType === 'deal' ? 'okazję' : 'produkt'}
                      </Badge>
                      <code className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                        {log.targetId}
                      </code>
                    </div>
                  </div>

                  {/* Moderator */}
                  <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <User className="h-3 w-3" />
                    <span className="max-w-[120px] truncate">{log.moderatorEmail || log.moderatorId || '—'}</span>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(log.timestamp)}
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
