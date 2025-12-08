'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Package,
  Flame
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportJob {
  id: string;
  type: 'products' | 'deals';
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
  progress: {
    total: number;
    completed: number;
    failed: number;
    current: number;
  };
  maxItemsPerSubcategory: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  logs?: Array<{
    timestamp: string;
    batchIndex: number;
    subcategory: string;
    status: 'success' | 'error';
    itemsAdded?: number;
    itemsUpdated?: number;
    itemsSkipped?: number;
    stages?: {
      fetched: number;
      deduplicated: number;
      enriched: number;
      translated: number;
      saved: number;
    };
    error?: string;
  }>;
  itemsCreated?: string[];
  itemsUpdated?: string[];
}

export function ImportManager() {
  const { user, getIdToken: getIdTokenFromContext } = useAuth();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch history on mount
  const getTokenOrThrow = useCallback(async () => {
    const token = await getIdTokenFromContext();
    if (!token) {
      throw new Error('Brak tokenu. Zaloguj się ponownie.');
    }
    return token;
  }, [getIdTokenFromContext]);

  const fetchHistory = useCallback(async () => {
    try {
      const token = await getTokenOrThrow();
      const res = await fetch('/api/admin/import/history?limit=10', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.jobs || []);
      } else if (res.status === 401) {
        toast.error('Brak autoryzacji do podglądu historii importu');
      }
    } catch (e) {
      console.error('Failed to fetch history:', e);
    }
  }, [getTokenOrThrow]);

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Poll active job status
  useEffect(() => {
    if (!activeJobId) {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      return;
    }

    const poll = async () => {
      try {
        const token = await getTokenOrThrow();
        const res = await fetch(`/api/admin/import/status?jobId=${activeJobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setActiveJob(data.job);

          // Stop polling if job finished
          if (['completed', 'failed', 'cancelled'].includes(data.job.status)) {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            fetchHistory(); // Refresh history
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    };

    poll(); // Initial fetch
    const interval = setInterval(poll, 3000); // Poll every 3s
    setPollingInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeJobId, pollingInterval, fetchHistory, getTokenOrThrow]);

  const startImport = async (type: 'products' | 'deals') => {
    if (loading) return;
    setLoading(true);

    try {
      const token = await getTokenOrThrow();
      const res = await fetch('/api/admin/import/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          maxItemsPerSubcategory: 10
        })
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(`Błąd: ${error.error}`);
        return;
      }

      const data = await res.json();
      toast.success(`Import rozpoczęty! Job ID: ${data.jobId}`);
      setActiveJobId(data.jobId);
    } catch (e: any) {
      toast.error(`Błąd połączenia: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const pauseJob = async () => {
    if (!activeJobId) return;
    try {
      const token = await getTokenOrThrow();
      const res = await fetch('/api/admin/import/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId: activeJobId, action: 'pause' })
      });
      if (res.ok) {
        toast.success('Import wstrzymany');
      }
    } catch (e: any) {
      toast.error(`Błąd: ${e.message}`);
    }
  };

  const resumeJob = async () => {
    if (!activeJobId) return;
    try {
      const token = await getTokenOrThrow();
      const res = await fetch('/api/admin/import/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId: activeJobId, action: 'resume' })
      });
      if (res.ok) {
        toast.success('Import wznowiony');
      }
    } catch (e: any) {
      toast.error(`Błąd: ${e.message}`);
    }
  };

  const cancelJob = async () => {
    if (!activeJobId) return;
    if (!confirm('Czy na pewno chcesz anulować import?')) return;
    
    try {
      const token = await getTokenOrThrow();
      const res = await fetch('/api/admin/import/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId: activeJobId, action: 'cancel' })
      });
      if (res.ok) {
        toast.success('Import anulowany');
        setActiveJobId(null);
        setActiveJob(null);
      }
    } catch (e: any) {
      toast.error(`Błąd: ${e.message}`);
    }
  };

  const rollbackJob = async (jobId: string) => {
    if (!confirm('⚠️ UWAGA! To usunie wszystkie produkty/okazje z tego importu. Kontynuować?')) return;
    
    setLoading(true);
    try {
      const token = await getTokenOrThrow();
      const res = await fetch('/api/admin/import/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ jobId })
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(`Błąd rollback: ${error.error}`);
        return;
      }

      const data = await res.json();
      toast.success(`Rollback zakończony: usunięto ${data.itemsDeleted} pozycji`);
      fetchHistory();
    } catch (e: any) {
      toast.error(`Błąd: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ImportJob['status']) => {
    const variants: Record<ImportJob['status'], { variant: any; icon: any; label: string }> = {
      queued: { variant: 'secondary', icon: Clock, label: 'W kolejce' },
      running: { variant: 'default', icon: RefreshCw, label: 'W trakcie' },
      paused: { variant: 'outline', icon: Pause, label: 'Wstrzymany' },
      completed: { variant: 'default', icon: CheckCircle, label: 'Zakończony' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Błąd' },
      cancelled: { variant: 'secondary', icon: XCircle, label: 'Anulowany' },
      rolled_back: { variant: 'outline', icon: Trash2, label: 'Cofnięty' },
    };

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const percentage = activeJob?.progress 
    ? Math.round((activeJob.progress.completed / activeJob.progress.total) * 100) 
    : 0;

  return (
    <Tabs defaultValue="active" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="active">Aktywny Import</TabsTrigger>
        <TabsTrigger value="history">Historia</TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="space-y-4">
        {/* Start Import Controls */}
        {!activeJobId && (
          <Card>
            <CardHeader>
              <CardTitle>Rozpocznij Import</CardTitle>
              <CardDescription>
                Import przebiega batch po batchu (10 pozycji per pod-podkategoria). Możesz go wstrzymać i wznowić.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button 
                onClick={() => startImport('products')} 
                disabled={loading}
                className="flex-1"
              >
                <Package className="mr-2 h-4 w-4" />
                Import Produktów
              </Button>
              <Button 
                onClick={() => startImport('deals')} 
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <Flame className="mr-2 h-4 w-4" />
                Import Okazji
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Active Job Progress */}
        {activeJob && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Import {activeJob.type === 'products' ? 'Produktów' : 'Okazji'}
                    {getStatusBadge(activeJob.status)}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Job ID: <code className="text-xs">{activeJob.id}</code>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {activeJob.status === 'running' && (
                    <Button size="sm" variant="outline" onClick={pauseJob}>
                      <Pause className="mr-1 h-3 w-3" />
                      Wstrzymaj
                    </Button>
                  )}
                  {activeJob.status === 'paused' && (
                    <Button size="sm" onClick={resumeJob}>
                      <Play className="mr-1 h-3 w-3" />
                      Wznów
                    </Button>
                  )}
                  {['running', 'paused'].includes(activeJob.status) && (
                    <Button size="sm" variant="destructive" onClick={cancelJob}>
                      <XCircle className="mr-1 h-3 w-3" />
                      Anuluj
                    </Button>
                  )}
                  {['completed', 'failed', 'cancelled'].includes(activeJob.status) && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setActiveJobId(null);
                        setActiveJob(null);
                      }}
                    >
                      Zamknij
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Postęp</span>
                  <span className="font-medium">{percentage}%</span>
                </div>
                <Progress value={percentage} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{activeJob.progress.completed} / {activeJob.progress.total} batchy</span>
                  <span className="text-red-600">{activeJob.progress.failed} błędów</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Utworzono</div>
                  <div className="text-2xl font-bold">{activeJob.itemsCreated?.length || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Zaktualizowano</div>
                  <div className="text-2xl font-bold">{activeJob.itemsUpdated?.length || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Max/batch</div>
                  <div className="text-2xl font-bold">{activeJob.maxItemsPerSubcategory}</div>
                </div>
              </div>

              {/* Logs */}
              {activeJob.logs && activeJob.logs.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-sm font-medium">Ostatnie operacje</div>
                  <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                    {activeJob.logs.slice(-10).reverse().map((log, idx) => (
                      <div 
                        key={idx} 
                        className={`p-2 rounded ${log.status === 'error' ? 'bg-red-50 text-red-900' : 'bg-green-50 text-green-900'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{log.subcategory}</span>
                          <span className="text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString('pl')}
                          </span>
                        </div>
                        {log.status === 'success' ? (
                          <div className="text-xs mt-1 space-y-0.5">
                            <div>💾 Dodano: {log.itemsAdded}, Zaktualizowano: {log.itemsUpdated}{log.itemsSkipped ? `, Pominięto: ${log.itemsSkipped}` : ''}</div>
                            {log.stages && (
                              <div className="text-muted-foreground">
                                📊 Fetch: {log.stages.fetched} → Dedupe: {log.stages.deduplicated} → Enrich: {log.stages.enriched} → Translate: {log.stages.translated} → Save: {log.stages.saved}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs mt-1">✗ {log.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Historia Importów</CardTitle>
            <CardDescription>
              Ostatnie 10 importów z możliwością rollback
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Brak historii importów</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((job) => {
                  const jobPercentage = Math.round((job.progress.completed / job.progress.total) * 100);
                  return (
                    <div 
                      key={job.id} 
                      className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {job.type === 'products' ? 'Produkty' : 'Okazje'}
                            </span>
                            {getStatusBadge(job.status)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(job.createdAt).toLocaleString('pl')}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActiveJobId(job.id);
                            }}
                          >
                            Pokaż
                          </Button>
                          {job.status === 'completed' && job.itemsCreated && job.itemsCreated.length > 0 && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => rollbackJob(job.id)}
                              disabled={loading}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Rollback
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <Progress value={jobPercentage} className="h-1 mb-2" />
                      
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{job.progress.completed}/{job.progress.total} batchy</span>
                        <span>
                          {job.itemsCreated?.length || 0} utworzono · {job.itemsUpdated?.length || 0} zaktualizowano
                        </span>
                      </div>
                      
                      {job.progress.failed > 0 && (
                        <div className="text-xs text-red-600 mt-1">
                          ⚠ {job.progress.failed} błędów
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
