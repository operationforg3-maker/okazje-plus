'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  PlayCircle,
  Search,
  Database,
  Zap,
} from 'lucide-react';

type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';
type QueueEntity = 'products' | 'deals';
type QueueOperation = 'upsert' | 'delete';

interface QueueTask {
  id: string;
  entity: QueueEntity;
  operation: QueueOperation;
  itemId: string;
  status: QueueStatus;
  attempts?: number;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  lastError?: string;
  note?: string;
}

interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

const statusColor: Record<QueueStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-300',
  processing: 'bg-blue-100 text-blue-800 border-blue-300',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
};

const operationLabel: Record<QueueOperation, string> = {
  upsert: 'Upsert',
  delete: 'Delete',
};

const entityLabel: Record<QueueEntity, string> = {
  products: 'Produkty',
  deals: 'Okazje',
};

export default function TypesenseQueuePage() {
  const { getIdToken } = useAuth();
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [stats, setStats] = useState<QueueStats>({ total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const getToken = useCallback(async () => {
    const token = await getIdToken();
    if (!token) throw new Error('Brak tokenu autoryzacji. Zaloguj się ponownie.');
    return token;
  }, [getIdToken]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({
        status: statusFilter,
        entity: entityFilter,
        operation: operationFilter,
        search,
        limit: '500',
      });

      const response = await fetch(`/api/admin/typesense-queue?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Nie udało się pobrać kolejki');
      }

      setTasks(data.tasks || []);
      setStats(data.stats || { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });
    } catch (error: any) {
      toast.error(error.message || 'Błąd pobierania danych');
    } finally {
      setLoading(false);
    }
  }, [entityFilter, getToken, operationFilter, search, statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchQueue();
    }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchQueue]);

  const filteredSelectionCount = selectedIds.length;

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(tasks.map((task) => task.id));
  };

  const toggleOne = (taskId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, taskId]));
      return prev.filter((id) => id !== taskId);
    });
  };

  const runAction = async (action: string, payload?: Record<string, any>) => {
    setActionLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/typesense-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...payload }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Operacja nie powiodła się');
      }

      toast.success(`Operacja ${action} zakończona`);
      setSelectedIds([]);
      await fetchQueue();
    } catch (error: any) {
      toast.error(error.message || 'Błąd operacji');
    } finally {
      setActionLoading(false);
    }
  };

  const groupedByStatus = useMemo(() => {
    return {
      pending: tasks.filter((task) => task.status === 'pending').length,
      processing: tasks.filter((task) => task.status === 'processing').length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      failed: tasks.filter((task) => task.status === 'failed').length,
    };
  }, [tasks]);

  const renderStatusIcon = (status: QueueStatus) => {
    if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (status === 'failed') return <AlertTriangle className="h-4 w-4 text-red-600" />;
    if (status === 'processing') return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
    return <Clock className="h-4 w-4 text-amber-600" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nadzór Kolejki Typesense</h1>
          <p className="text-muted-foreground">Pełna kontrola: podgląd, retry, ręczne przetwarzanie i czyszczenie tasków indeksacji.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={autoRefresh ? 'secondary' : 'outline'} onClick={() => setAutoRefresh((v) => !v)}>
            <Activity className="mr-2 h-4 w-4" />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button variant="outline" onClick={() => fetchQueue()} disabled={loading || actionLoading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Odśwież
          </Button>
          <Button onClick={() => runAction('process_pending', { limit: 200 })} disabled={actionLoading}>
            <PlayCircle className="mr-2 h-4 w-4" />
            Przetwórz pending
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Wszystkie taski</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-amber-600">{stats.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Processing</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-blue-600">{stats.processing}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Completed</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-emerald-600">{stats.completed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Failed</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-semibold text-red-600">{stats.failed}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtry i akcje masowe</CardTitle>
          <CardDescription>Użyj filtrów do diagnostyki i akcji operacyjnych na zaznaczonych taskach.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Encja</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="deals">Okazje</SelectItem>
                  <SelectItem value="products">Produkty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operacja</Label>
              <Select value={operationFilter} onValueChange={setOperationFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="upsert">Upsert</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Wyszukiwanie</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ID taska, itemId, error" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fetchQueue()} disabled={loading || actionLoading}>Zastosuj filtry</Button>
            <Button variant="outline" onClick={() => runAction('retry_failed', { limit: 500 })} disabled={actionLoading}>
              <RotateCcw className="mr-2 h-4 w-4" /> Retry failed
            </Button>
            <Button
              variant="outline"
              onClick={() => runAction('process_pending', { limit: 200 })}
              disabled={actionLoading || groupedByStatus.pending === 0}
            >
              <Database className="mr-2 h-4 w-4" /> Przetwórz z widoku
            </Button>
            <Button variant="outline" onClick={() => runAction('release_processing', { limit: 500 })} disabled={actionLoading}>
              <Activity className="mr-2 h-4 w-4" /> Uwolnij processing
            </Button>
            <Button variant="outline" onClick={() => runAction('retry_selected', { taskIds: selectedIds })} disabled={actionLoading || selectedIds.length === 0}>
              <Zap className="mr-2 h-4 w-4" /> Retry zaznaczone ({filteredSelectionCount})
            </Button>
            <Button variant="destructive" onClick={() => runAction('delete_selected', { taskIds: selectedIds })} disabled={actionLoading || selectedIds.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" /> Usuń zaznaczone ({filteredSelectionCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">Tabela tasków</TabsTrigger>
          <TabsTrigger value="overview">Szybki overview</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Overview bieżącego widoku</CardTitle>
              <CardDescription>Statystyki po zastosowanych filtrach.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-semibold text-amber-600">{groupedByStatus.pending}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-semibold text-blue-600">{groupedByStatus.processing}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-semibold text-emerald-600">{groupedByStatus.completed}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-semibold text-red-600">{groupedByStatus.failed}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Taski kolejki ({tasks.length})</CardTitle>
              <CardDescription>Najbardziej aktualny stan indeksacji Typesense.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto rounded-lg border">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-2 text-left">
                        <Checkbox
                          checked={tasks.length > 0 && selectedIds.length === tasks.length}
                          onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                          aria-label="Zaznacz wszystkie"
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Encja</th>
                      <th className="px-3 py-2 text-left">Operacja</th>
                      <th className="px-3 py-2 text-left">Item ID</th>
                      <th className="px-3 py-2 text-left">Task ID</th>
                      <th className="px-3 py-2 text-left">Próby</th>
                      <th className="px-3 py-2 text-left">Ostatnia aktualizacja</th>
                      <th className="px-3 py-2 text-left">Błąd / Notatka</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Ładowanie danych kolejki...
                        </td>
                      </tr>
                    ) : tasks.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                          Brak tasków dla wybranego zakresu.
                        </td>
                      </tr>
                    ) : (
                      tasks.map((task) => (
                        <tr key={task.id} className="border-t align-top">
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={selectedIds.includes(task.id)}
                              onCheckedChange={(checked) => toggleOne(task.id, Boolean(checked))}
                              aria-label={`Zaznacz task ${task.id}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {renderStatusIcon(task.status)}
                              <Badge className={statusColor[task.status]}>{task.status}</Badge>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline">{entityLabel[task.entity]}</Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary">{operationLabel[task.operation]}</Badge>
                          </td>
                          <td className="px-3 py-2 font-mono">{task.itemId}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{task.id}</td>
                          <td className="px-3 py-2">{task.attempts || 0}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {task.updatedAt || task.createdAt || '-'}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {task.lastError ? (
                              <span className="text-red-600">{task.lastError}</span>
                            ) : task.note ? (
                              <span className="text-amber-700">{task.note}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
