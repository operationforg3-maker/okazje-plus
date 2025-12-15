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
  const [jobType, setJobType] = useState<'products' | 'deals'>('products');
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
      
      const response = await fetch('/api/admin/import/queue', {
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
  }, [getIdToken, isMounted]);

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
          type: jobType,
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
          <CardTitle className="flex items-center gap-2">
            ➕ Utwórz nowy job importu
            <span className="text-xs font-mono bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-100 px-2 py-1 rounded">
              v2.1
            </span>
          </CardTitle>
          <CardDescription>
            Zadania działają w tle - nie trzeba czekać na zakończenie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Typ importu</Label>
            <div className="flex gap-3">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="type-products"
                  name="jobType"
                  value="products"
                  checked={jobType === 'products'}
                  onChange={(e) => setJobType('products')}
                  className="mr-2"
                />
                <Label htmlFor="type-products" className="cursor-pointer mb-0">
                  📦 Produkty
                </Label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="type-deals"
                  name="jobType"
                  value="deals"
                  checked={jobType === 'deals'}
                  onChange={(e) => setJobType('deals')}
                  className="mr-2"
                />
                <Label htmlFor="type-deals" className="cursor-pointer mb-0">
                  🔥 Okazje (min 30% zniżka)
                </Label>
              </div>
            </div>
          </div>

          <div>
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
              <CardTitle>📋 Historia Zadań (v2.1)</CardTitle>
              <CardDescription>Live data - Ostatnie 20 zadań (auto-refresh co 5s)</CardDescription>
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
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Brak zadań. Utwórz pierwszy powyżej.
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
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
                const createdTime = new Date(job.createdAt);
                const isToday = createdTime.toDateString() === new Date().toDateString();
                const timeStr = isToday 
                  ? createdTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
                  : createdTime.toLocaleDateString('pl-PL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={job.id}
                    className={`border rounded-lg p-3 space-y-2 transition-all ${
                      job.status === 'running' 
                        ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700' 
                        : job.status === 'completed'
                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                        : job.status === 'failed'
                        ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        {getStatusBadge(job.status)}
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                          {job.id.slice(0, 8)}...
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {timeStr}
                        </span>
                      </div>

                      {(job.status === 'running' || job.status === 'pending' || job.status === 'queued' || job.status === 'paused') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelJob(job.id)}
                          className="h-7 px-2"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        📦 {job.sources?.join(', ') || 'brak danych'}
                      </span>
                      {job.status === 'running' && (
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {progressPercent}%
                        </span>
                      )}
                    </div>

                    {job.status === 'running' && (
                      <>
                        <Progress value={progressPercent} className="h-1.5" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            <strong>{progress.currentSource}</strong> → {progress.currentCategory}
                          </span>
                          <span>
                            📊 {progress.importedProducts} produktów | 📂 {progress.processedCategories}/{progress.totalCategories}
                          </span>
                        </div>
                      </>
                    )}

                    {job.status === 'completed' && job.results && (
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-white dark:bg-gray-800 rounded px-2 py-1">
                          <div className="font-semibold text-green-700 dark:text-green-400">{job.results.totalProducts}</div>
                          <div className="text-muted-foreground">Produktów</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded px-2 py-1">
                          <div className="font-semibold text-green-700 dark:text-green-400">{job.results.totalVariants}</div>
                          <div className="text-muted-foreground">Wariantów</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded px-2 py-1">
                          <div className="font-semibold text-green-700 dark:text-green-400">{Math.round(job.results.duration)}s</div>
                          <div className="text-muted-foreground">Czas</div>
                        </div>
                      </div>
                    )}

                    {job.status === 'failed' && (
                      <div className="text-xs text-red-700 dark:text-red-300">
                        ⚠️ Błędów: {errorsCount}
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
