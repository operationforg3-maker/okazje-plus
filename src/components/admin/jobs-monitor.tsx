'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  RefreshCw, 
  XCircle, 
  CheckCircle, 
  Clock, 
  Loader2,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

interface ImportJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'queued' | 'paused';
  sources: string[];
  config: {
    maxProductsPerCategory: number;
    enableAdvancedFeatures: boolean;
    enableAIEnrichment: boolean;
    saveDraftsOnly: boolean;
  };
  progress: {
    currentSource: string;
    currentCategory: string;
    processedCategories: number;
    totalCategories: number;
    importedProducts: number;
    errors: string[];
  };
  results?: {
    totalProducts: number;
    totalVariants: number;
    duration: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface JobsMonitorProps {
  onConsoleLog?: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

export function JobsMonitor({ onConsoleLog }: JobsMonitorProps) {
  const { user, getIdToken } = useAuth();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('active');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [apiConfigStatus, setApiConfigStatus] = useState<{
    configured: Record<string, boolean>;
    issues: Record<string, string[]>;
    checked: boolean;
  }>({ configured: {}, issues: {}, checked: false });
  
  // Hydration guard
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // New job form
  const [sources, setSources] = useState({
    aliexpress: false,
    convertiser: false,
    allegro: false,
    amazon: false,
    ebay: false,
  });
  const [maxProducts, setMaxProducts] = useState(20);
  const [enableAdvanced, setEnableAdvanced] = useState(true);
  const [enableAI, setEnableAI] = useState(false);
  const [killingAll, setKillingAll] = useState(false);

  const killAllJobs = async () => {
    if (!confirm('⚠️ NIEODWRACALNE: Czy na pewno chcesz zatrzymać WSZYSTKIE zadania importu?')) {
      return;
    }

    try {
      setKillingAll(true);
      const idToken = await getIdToken();

      const response = await fetch('/api/admin/import/kill-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to kill all jobs');
      }

      const data = await response.json();
      toast.success(`Zatrzymano ${data.results.killed} zadań`);
      onConsoleLog?.(`🔥 EMERGENCY: Zatrzymano ${data.results.killed} wszystkich zadań`, 'error');
      
      // Refresh immediately
      fetchJobs();
    } catch (error: any) {
      console.error('Error killing all jobs:', error);
      toast.error('Nie udało się zatrzymać wszystkich zadań');
    } finally {
      setKillingAll(false);
    }
  };

  const fetchJobs = useCallback(async () => {
    if (!isMounted) return;
    try {
      setLoading(true);
      const idToken = await getIdToken();
      
      // Build query params
      const params = new URLSearchParams({
        status: statusFilter,
        sortBy: sortBy,
        sortOrder: sortOrder,
        limit: '50',
      });
      
      const response = await fetch(`/api/admin/import/queue?${params}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error: any) {
      console.error('Error fetching jobs:', error);
      toast.error('Nie udalo sie pobrac jobow');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, isMounted, statusFilter, sortBy, sortOrder]);

  // Check API configuration on mount
  useEffect(() => {
    const checkApiConfig = async () => {
      try {
        const response = await fetch('/api/admin/marketplaces/health');
        if (response.ok) {
          const data = await response.json();
          const configured: Record<string, boolean> = {};
          const issues: Record<string, string[]> = {};
          
          Object.entries(data.sources).forEach(([source, status]: [string, any]) => {
            configured[source] = status.configured;
            if (!status.configured) {
              issues[source] = status.missingVars;
            }
          });
          
          setApiConfigStatus({
            configured,
            issues,
            checked: true,
          });
        }
      } catch (error) {
        console.error('Failed to check API config:', error);
        setApiConfigStatus({
          configured: {},
          issues: {},
          checked: true,
        });
      }
    };

    checkApiConfig();
  }, []);

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh running jobs
  useEffect(() => {
    const hasRunningJobs = jobs.some(job => 
      job.status === 'running' || job.status === 'pending' || job.status === 'queued' || job.status === 'paused'
    );

    if (!hasRunningJobs) return;

    const interval = setInterval(() => {
      fetchJobs();
    }, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  const createJob = async () => {
    const enabledSources = Object.entries(sources)
      .filter(([_, enabled]) => enabled)
      .map(([source]) => source);

    if (enabledSources.length === 0) {
      toast.error('Wybierz przynajmniej jedno zrodlo');
      return;
    }

    // Check if any enabled source is not configured
    const unconfiguredSources = enabledSources.filter(source => 
      apiConfigStatus.checked && apiConfigStatus.configured[source] !== true
    );
    
    if (unconfiguredSources.length > 0) {
      const sourceNames = unconfiguredSources.join(', ');
      const errorDetails = unconfiguredSources.map(source => {
        const missing = apiConfigStatus.issues[source] || [];
        return `${source}: ${missing.join(', ')}`;
      }).join(' | ');
      
      toast.error(`Źródła nie skonfigurowane: ${sourceNames}`);
      onConsoleLog?.(`❌ Nie można utworzyć joba: Źródła nie skonfigurowane`, 'error');
      onConsoleLog?.(`   ${errorDetails}`, 'error');
      return;
    }

    try {
      setCreating(true);
      const idToken = await getIdToken();

      onConsoleLog?.(`🚀 Tworzenie nowego joba importu...`, 'info');
      onConsoleLog?.(`📦 Zrodla: ${enabledSources.join(', ')}`, 'info');

      const response = await fetch('/api/admin/import/queue', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sources,
          maxProductsPerCategory: maxProducts,
          enableAdvancedFeatures: enableAdvanced,
          enableAIEnrichment: enableAI,
          saveDraftsOnly: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || 'Failed to create job';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      toast.success(`Job utworzony: ${data.jobId}`);
      onConsoleLog?.(`✅ Job utworzony: ${data.jobId}`, 'success');
      onConsoleLog?.(`⏳ Sprawdzaj status w zakladce Jobs`, 'info');

      // Refresh jobs list
      fetchJobs();
    } catch (error: any) {
      console.error('Error creating job:', error);
      toast.error('Nie udalo sie utworzyc joba');
      onConsoleLog?.(`❌ Blad: ${error.message}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      const idToken = await getIdToken();

      const response = await fetch(`/api/admin/import/queue/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel job');
      }

      toast.success('Job anulowany');
      onConsoleLog?.(`🚫 Job ${jobId} anulowany`, 'warning');
      fetchJobs();
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      toast.error('Nie udalo sie anulowac joba');
    }
  };

  const getStatusBadge = (status: ImportJob['status']) => {
    switch (status) {
      case 'pending':
      case 'queued':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Oczekuje</Badge>;
      case 'running':
        return <Badge variant="default" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />W trakcie</Badge>;
      case 'paused':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Wstrzymany</Badge>;
      case 'completed':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />Ukończony</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Błąd</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />Anulowany</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* API Configuration Status */}
      {apiConfigStatus.checked && Object.keys(apiConfigStatus.issues).length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                ⚠️ Niektóre źródła nie są skonfigurowane
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                Nie można importować z następujących źródeł bez konfiguracji API:
              </p>
              <div className="space-y-1">
                {Object.entries(apiConfigStatus.issues).map(([source, missing]) => (
                  <div key={source} className="text-xs text-yellow-700 dark:text-yellow-300 font-mono">
                    <span className="font-bold capitalize">{source}:</span> {missing.join(', ')}
                  </div>
                ))}
              </div>
              {Object.keys(apiConfigStatus.configured).length > Object.keys(apiConfigStatus.issues).length && (
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  ✅ Skonfigurowane źródła: {Object.entries(apiConfigStatus.configured)
                    .filter(([_, conf]) => conf)
                    .map(([source]) => source)
                    .join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Create New Job */}
      <Card>
        <CardHeader>
          <CardTitle>Utwórz nowy job importu</CardTitle>
          <CardDescription>
            Jobs działają w tle - nie trzeba czekać na zakończenie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Źródła importu</Label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(sources).map(([source, enabled]) => {
                const isConfigured = apiConfigStatus.checked ? apiConfigStatus.configured[source] === true : false;
                const showStatus = apiConfigStatus.checked;
                
                return (
                  <div key={source} className="flex items-center space-x-2">
                    <Checkbox
                      id={source}
                      checked={enabled}
                      onCheckedChange={(checked) => 
                        setSources(prev => ({ ...prev, [source]: checked === true }))
                      }
                      disabled={showStatus && !isConfigured}
                    />
                    <Label 
                      htmlFor={source} 
                      className={`capitalize cursor-pointer flex items-center gap-1 ${
                        showStatus && !isConfigured ? 'opacity-50' : ''
                      }`}
                    >
                      {source}
                      {showStatus && (
                        isConfigured ? (
                          <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                        ) : (
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">⚠</span>
                        )
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="maxProducts">Produktów na kategorię</Label>
            <Input
              id="maxProducts"
              type="number"
              min={1}
              max={50}
              value={maxProducts}
              onChange={(e) => setMaxProducts(parseInt(e.target.value) || 20)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="advanced"
                checked={enableAdvanced}
                onCheckedChange={(checked) => setEnableAdvanced(checked === true)}
              />
              <Label htmlFor="advanced" className="cursor-pointer">
                Zaawansowane funkcje (SKU, shipping, variants)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="ai"
                checked={enableAI}
                onCheckedChange={(checked) => setEnableAI(checked === true)}
              />
              <Label htmlFor="ai" className="cursor-pointer">
                AI enrichment (3 agenty - wolniejsze, lepsze opisy)
              </Label>
            </div>
          </div>

          <Button 
            onClick={createJob} 
            disabled={creating || (
              apiConfigStatus.checked && Object.entries(sources).some(([source, enabled]) => 
                enabled && apiConfigStatus.configured[source] !== true
              )
            )}
            className="w-full"
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Tworzenie...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Utwórz job
              </>
            )}
          </Button>
          {apiConfigStatus.checked && Object.entries(sources).some(([source, enabled]) => 
            enabled && apiConfigStatus.configured[source] !== true
          ) && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
              Niektóre wybrane źródła nie są skonfigurowane
            </p>
          )}
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Twoje joby importu</CardTitle>
              <CardDescription>
                {statusFilter === 'active' ? 'Aktywne joby' : statusFilter === 'all' ? 'Wszystkie joby' : `Joby: ${statusFilter}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchJobs}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              {jobs.some(j => ['running', 'queued', 'paused'].includes(j.status)) && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={killAllJobs}
                  disabled={killingAll}
                  className="gap-1"
                >
                  {killingAll ? (
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
              )}
            </div>
          </div>
          
          {/* Filter/Sort Controls */}
          <div className="flex gap-3 mt-4 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Status:</Label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="active">Aktywne</option>
                <option value="all">Wszystkie</option>
                <option value="completed">Ukończone</option>
                <option value="failed">Nieudane</option>
                <option value="queued">Kolejkowane</option>
                <option value="running">W toku</option>
                <option value="paused">Wstrzymane</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <Label className="text-sm">Sortuj:</Label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="createdAt">Data utworzenia</option>
                <option value="updatedAt">Data aktualizacji</option>
                <option value="status">Status</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <Label className="text-sm">Kierunek:</Label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
              >
                <option value="desc">Malejąco</option>
                <option value="asc">Rosnąco</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Brak jobów. Utwórz pierwszy powyżej.
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => {
                const progress = job.progress ?? {
                  currentSource: '-',
                  currentCategory: '-',
                  processedCategories: 0,
                  totalCategories: 0,
                  importedProducts: 0,
                  errors: [] as string[],
                };

                const progressPercent = progress.totalCategories
                  ? Math.round((progress.processedCategories / progress.totalCategories) * 100)
                  : 0;

                const errorsCount = progress.errors?.length ?? 0;

                return (
                  <div
                    key={job.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(job.status)}
                          <span className="text-xs text-muted-foreground">
                            ID: {job.id.slice(0, 8)}...
                          </span>
                        </div>
                        <div className="text-sm">
                          <strong>Źródła:</strong> {job.sources?.join(', ') || 'brak danych'}
                        </div>
                        <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                          Utworzony: {new Date(job.createdAt).toLocaleString('pl-PL')}
                        </div>
                      </div>

                      {(job.status === 'running' || job.status === 'pending' || job.status === 'queued' || job.status === 'paused') && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => cancelJob(job.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Anuluj
                        </Button>
                      )}
                    </div>

                    {job.status === 'running' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {progress.currentSource} → {progress.currentCategory}
                          </span>
                          <span className="font-medium">
                            {progressPercent}%
                          </span>
                        </div>
                        <Progress value={progressPercent} />
                        <div className="text-xs text-muted-foreground">
                          Produktów: {progress.importedProducts} | 
                          Kategorie: {progress.processedCategories}/{progress.totalCategories}
                        </div>
                      </div>
                    )}

                    {job.status === 'completed' && job.results && (
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-3 text-sm">
                        <div className="font-medium text-green-900 dark:text-green-100 mb-1">
                          ✅ Import zakończony
                        </div>
                        <div className="text-green-800 dark:text-green-200 space-y-0.5">
                          <div>Produktów: {job.results.totalProducts}</div>
                          <div>Wariantów: {job.results.totalVariants}</div>
                          <div>Czas: {Math.round(job.results.duration)}s</div>
                        </div>
                      </div>
                    )}

                    {job.status === 'failed' && (
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3 text-sm">
                        <div className="font-medium text-red-900 dark:text-red-100 mb-1">
                          <AlertCircle className="inline h-4 w-4 mr-1" />
                          Import nie powiódł się
                        </div>
                        <div className="text-red-800 dark:text-red-200">
                          Błędów: {errorsCount}
                        </div>
                      </div>
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
