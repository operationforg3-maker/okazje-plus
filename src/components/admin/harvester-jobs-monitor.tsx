'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckCircle, Clock, Loader2, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

interface HarvesterJob {
  id: string;
  source: string;
  query: string;
  maxResults: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  productsFound: number;
  productsCreated: number;
  dealsCreated: number;
  duplicatesSkipped: number;
  startedAt: string;
  completedAt?: string;
  logs: any[];
}

interface HarvesterJobsMonitorProps {
  onConsoleLog?: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export function HarvesterJobsMonitor({ onConsoleLog }: HarvesterJobsMonitorProps) {
  const { getIdToken } = useAuth();
  const [jobs, setJobs] = useState<HarvesterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [killing, setKilling] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const idToken = await getIdToken();
      const res = await fetch('/api/admin/harvester-jobs?limit=50', {
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err: any) {
      console.error('Error fetching harvester jobs:', err);
      onConsoleLog?.('❌ Nie udało się załadować zadań harwestera', 'error');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, onConsoleLog]);

  useEffect(() => {
    if (!isMounted) return;
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [isMounted, fetchJobs]);

  const killAllRunningJobs = async () => {
    if (!confirm('⚠️ Czy na pewno chcesz zatrzymać WSZYSTKIE aktywne zadania harvestera?')) return;

    setKilling(true);
    try {
      const idToken = await getIdToken();
      const res = await fetch('/api/admin/harvester/kill-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to kill jobs');
      const data = await res.json();
      toast.success(`Zatrzymano ${data.killed} zadań`);
      onConsoleLog?.(`✅ Zatrzymano ${data.killed} zadań harwestera`, 'success');
      await fetchJobs();
    } catch (err: any) {
      toast.error('Nie udało się zatrzymać zadań');
      onConsoleLog?.(`❌ Błąd: ${err.message}`, 'error');
      console.error(err);
    } finally {
      setKilling(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Usunąć to zadanie z historii?')) return;
    try {
      const idToken = await getIdToken();
      const res = await fetch(`/api/admin/harvester-jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idToken}` },
      });
      if (res.ok) {
        toast.success('Zadanie usunięte');
        onConsoleLog?.('✅ Zadanie usunięte z historii', 'success');
        await fetchJobs();
      }
    } catch (err) {
      toast.error('Nie udało się usunąć zadania');
      onConsoleLog?.('❌ Nie udało się usunąć zadania', 'error');
    }
  };

  if (!isMounted) {
    return <div className="text-center py-4 text-muted-foreground">Ładowanie...</div>;
  }

  const runningJobs = jobs.filter(j => j.status === 'running');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'failed');
  const pausedJobs = jobs.filter(j => j.status === 'paused');

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aktywne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{runningJobs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">w trakcie</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ukończone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{completedJobs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">powodzenie</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Błędy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{failedJobs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">niepowodzenie</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Zatrzymane</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{pausedJobs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">przerwane</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Razem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{jobs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">zadań</p>
          </CardContent>
        </Card>
      </div>

      {/* Kill All Button */}
      {runningJobs.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-100">🔴 Aktywne zadania</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {runningJobs.length} zadań harvestera jest w trakcie. Chcesz je zatrzymać?
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={killAllRunningJobs}
              disabled={killing}
              className="gap-2"
            >
              {killing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Zatrzymywanie...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Kill All
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="running" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="running">
            Aktywne ({runningJobs.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Ukończone ({completedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="paused">
            Zatrzymane ({pausedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="failed">
            Błędy ({failedJobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="running" className="space-y-4">
          {runningJobs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Brak aktywnych zadań
              </CardContent>
            </Card>
          ) : (
            runningJobs.map(job => (
              <JobCard key={job.id} job={job} onDelete={deleteJob} />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedJobs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Brak ukończonych zadań
              </CardContent>
            </Card>
          ) : (
            completedJobs.map(job => (
              <JobCard key={job.id} job={job} onDelete={deleteJob} />
            ))
          )}
        </TabsContent>

        <TabsContent value="paused" className="space-y-4">
          {pausedJobs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Brak zatrzymanych zadań
              </CardContent>
            </Card>
          ) : (
            pausedJobs.map(job => (
              <JobCard key={job.id} job={job} onDelete={deleteJob} />
            ))
          )}
        </TabsContent>

        <TabsContent value="failed" className="space-y-4">
          {failedJobs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Brak zadań z błędami
              </CardContent>
            </Card>
          ) : (
            failedJobs.map(job => (
              <JobCard key={job.id} job={job} onDelete={deleteJob} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobCard({ job, onDelete }: { job: HarvesterJob; onDelete: (id: string) => void }) {
  const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
    running: { color: 'bg-blue-100 text-blue-900', icon: Loader2, label: '⏳ W trakcie' },
    completed: { color: 'bg-green-100 text-green-900', icon: CheckCircle, label: '✅ Ukończone' },
    failed: { color: 'bg-red-100 text-red-900', icon: AlertCircle, label: '❌ Błąd' },
    paused: { color: 'bg-orange-100 text-orange-900', icon: Zap, label: '⏸ Zatrzymane' },
  };

  const config = statusConfig[job.status] || statusConfig.failed;
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">
                {job.source.toUpperCase()} — {job.query}
              </CardTitle>
              <Badge className={config.color}>
                {job.status === 'running' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                {config.label}
              </Badge>
            </div>
            <CardDescription className="text-xs mt-1">
              Limit: {job.maxResults} produktów
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(job.id)}
            className="text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Znalezione</p>
            <p className="text-lg font-semibold">{job.productsFound}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Produkty</p>
            <p className="text-lg font-semibold text-blue-600">{job.productsCreated}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Okazje</p>
            <p className="text-lg font-semibold text-green-600">{job.dealsCreated}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Duplikaty</p>
            <p className="text-lg font-semibold text-amber-600">{job.duplicatesSkipped}</p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Start: {new Date(job.startedAt).toLocaleString('pl-PL')}
          </div>
          {job.completedAt && (
            <div className="flex items-center gap-1 mt-1">
              <CheckCircle className="h-3 w-3" />
              Koniec: {new Date(job.completedAt).toLocaleString('pl-PL')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
