/**
 * Schedule Manager - Harmonogramy zadań dla bazy danych
 *
 * Funkcjonalność:
 * - Tworzy automatyczne harmonogramy dla aktualizacji produktów/okazji
 * - Wspiera: daily, weekly, monthly, manual
 * - Loguje wykonanie w Cloud Logs
 * - Integruje się z JobQueue dla background processing
 *
 * API:
 * - POST /api/admin/schedule/run - Uruchom zadanie
 *
 * Todo:
 * - Persystencja harmonogramów w Firestore
 * - Cloud Scheduler integration
 * - Retry logic dla nieudanych zadań
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Clock, Play, Pause, Trash2, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

interface ScheduledTask {
  id: string;
  name: string;
  type: 'product_update' | 'deals_refresh' | 'link_verify' | 'index_repair' | 'cleanup';
  schedule: 'daily' | 'weekly' | 'monthly' | 'manual';
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  config: {
    scope?: 'all' | 'active' | 'inactive' | 'stale';
    maxAge?: number; // days
    batchSize?: number;
    retryFailed?: boolean;
  };
}

interface ScheduleManagerProps {
  onConsoleLog?: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export function ScheduleManager({ onConsoleLog }: ScheduleManagerProps) {
  const { getIdToken } = useAuth();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Set<string>>(new Set());

  // Domyślne zadania
  const defaultTasks: ScheduledTask[] = [
    {
      id: 'product_daily_update',
      name: 'Dziennie: Odświeżenie produktów',
      type: 'product_update',
      schedule: 'daily',
      enabled: true,
      status: 'idle',
      config: {
        scope: 'active',
        batchSize: 500,
        retryFailed: true,
      },
    },
    {
      id: 'deals_weekly_refresh',
      name: 'Tygodniowo: Aktualizacja okazji',
      type: 'deals_refresh',
      schedule: 'weekly',
      enabled: true,
      status: 'idle',
      config: {
        scope: 'all',
        maxAge: 30,
        batchSize: 200,
      },
    },
    {
      id: 'link_verify_daily',
      name: 'Codziennie: Weryfikacja linków afiliacyjnych',
      type: 'link_verify',
      schedule: 'daily',
      enabled: true,
      status: 'idle',
      config: {
        scope: 'active',
        batchSize: 100,
        retryFailed: true,
      },
    },
    {
      id: 'index_repair_weekly',
      name: 'Co tydzień: Naprawa Firebase Indexes',
      type: 'index_repair',
      schedule: 'weekly',
      enabled: false,
      status: 'idle',
      config: {
        scope: 'all',
      },
    },
    {
      id: 'cleanup_monthly',
      name: 'Miesięcznie: Czyszczenie bazy danych',
      type: 'cleanup',
      schedule: 'monthly',
      enabled: false,
      status: 'idle',
      config: {
        scope: 'inactive',
        maxAge: 90,
        batchSize: 1000,
      },
    },
  ];

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        // TODO: Załaduj z Firestore jeśli zestały zapisane
        setTasks(defaultTasks);
        onConsoleLog?.('✅ Harmonogramy załadowane', 'success');
      } catch (error) {
        onConsoleLog?.(`❌ Błąd przy ładowaniu: ${error}`, 'error');
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
  }, []);

  const toggleTask = async (taskId: string) => {
    try {
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId ? { ...t, enabled: !t.enabled } : t
        )
      );
      const task = tasks.find(t => t.id === taskId);
      onConsoleLog?.(
        `${task?.enabled ? '⏸' : '▶'} Zadanie: ${task?.name}`,
        'info'
      );
    } catch (error) {
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    }
  };

  const runTask = async (taskId: string) => {
    try {
      setRunning(prev => new Set([...prev, taskId]));
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      onConsoleLog?.(`▶️ Uruchamiam: ${task.name}...`, 'info');

      const token = await getIdToken();
      const response = await fetch('/api/admin/schedule/run', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ taskId, config: task.config }),
      });

      if (!response.ok) throw new Error('Błąd uruchamiania zadania');

      const result = await response.json();
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? {
              ...t,
              status: 'completed',
              lastRun: new Date().toISOString(),
              nextRun: calculateNextRun(task.schedule),
            }
            : t
        )
      );

      onConsoleLog?.(
        `✅ Ukończono: ${result.processed} elementów przetworzono`,
        'success'
      );
    } catch (error) {
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId ? { ...t, status: 'failed' } : t
        )
      );
      onConsoleLog?.(`❌ Błąd: ${error}`, 'error');
    } finally {
      setRunning(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    onConsoleLog?.('🗑 Zadanie usunięte', 'warning');
  };

  const getScheduleLabel = (schedule: string) => {
    const labels: Record<string, string> = {
      daily: '📅 Codziennie',
      weekly: '📆 Co tydzień',
      monthly: '📊 Miesięcznie',
      manual: '🖱 Ręczne',
    };
    return labels[schedule] || schedule;
  };

  const getStatusBadge = (status: ScheduledTask['status']) => {
    const badges: Record<ScheduledTask['status'], { label: string; variant: any }> = {
      idle: { label: 'Czeka', variant: 'secondary' },
      running: { label: 'W toku', variant: 'default' },
      completed: { label: 'Ukończone', variant: 'default' },
      failed: { label: 'Błąd', variant: 'destructive' },
    };
    return badges[status];
  };

  const calculateNextRun = (schedule: string): string => {
    const now = new Date();
    let next = new Date(now);

    switch (schedule) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(2, 0, 0, 0);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        next.setHours(2, 0, 0, 0);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        next.setHours(2, 0, 0, 0);
        break;
    }

    return next.toISOString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg">Harmonogramy zadań</h3>
          <p className="text-sm text-muted-foreground">
            Automatyczne zadania dla bazy produktów i okazji
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nowe zadanie
        </Button>
      </div>

      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          Zadania uruchamiają się automatycznie o 02:00 UTC w wybranym harmonogramie.
          Możesz je także uruchomić ręcznie klikając "Uruchom".
        </AlertDescription>
      </Alert>

      <ScrollArea className="h-[600px] pr-4">
        <div className="space-y-3">
          {tasks.map(task => (
            <Card key={task.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={task.enabled}
                      onCheckedChange={() => toggleTask(task.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{task.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {getScheduleLabel(task.schedule)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {task.lastRun && (
                          <span>
                            Ostatnie: {new Date(task.lastRun).toLocaleString('pl-PL')}
                          </span>
                        )}
                        {task.nextRun && task.enabled && (
                          <span>
                            Następne: {new Date(task.nextRun).toLocaleString('pl-PL')}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        {task.config.scope && <div>• Zakres: {task.config.scope}</div>}
                        {task.config.batchSize && <div>• Rozmiar partii: {task.config.batchSize}</div>}
                        {task.config.maxAge && <div>• Max wiek: {task.config.maxAge} dni</div>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant={getStatusBadge(task.status).variant}
                      className="text-xs"
                    >
                      {getStatusBadge(task.status).label}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => runTask(task.id)}
                      disabled={running.has(task.id)}
                    >
                      {running.has(task.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTask(task.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <Alert variant="default">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          💡 Każde zadanie jest logowane w Google Cloud Logs. Możesz monitorować
          wyniki w Cloud Logging dashboard.
        </AlertDescription>
      </Alert>
    </div>
  );
}
