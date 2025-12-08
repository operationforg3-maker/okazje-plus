'use client';

import { useState, useEffect } from 'react';
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
  AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';

interface ImportJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
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
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  
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

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  // Auto-refresh running jobs
  useEffect(() => {
    const hasRunningJobs = jobs.some(job => 
      job.status === 'running' || job.status === 'pending'
    );

    if (!hasRunningJobs) return;

    const interval = setInterval(() => {
      fetchJobs();
    }, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, [jobs]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const idToken = await user?.getIdToken();
      
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
  };

  const createJob = async () => {
    const enabledSources = Object.entries(sources)
      .filter(([_, enabled]) => enabled)
      .map(([source]) => source);

    if (enabledSources.length === 0) {
      toast.error('Wybierz przynajmniej jedno zrodlo');
      return;
    }

    try {
      setCreating(true);
      const idToken = await user?.getIdToken();

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
        throw new Error('Failed to create job');
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
      const idToken = await user?.getIdToken();

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
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Oczekuje</Badge>;
      case 'running':
        return <Badge variant="default" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />W trakcie</Badge>;
      case 'completed':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />Ukończony</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Błąd</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />Anulowany</Badge>;
    }
  };

  const getProgressPercent = (job: ImportJob) => {
    if (job.progress.totalCategories === 0) return 0;
    return Math.round((job.progress.processedCategories / job.progress.totalCategories) * 100);
  };

  return (
    <div className="space-y-6">
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
              {Object.entries(sources).map(([source, enabled]) => (
                <div key={source} className="flex items-center space-x-2">
                  <Checkbox
                    id={source}
                    checked={enabled}
                    onCheckedChange={(checked) => 
                      setSources(prev => ({ ...prev, [source]: checked === true }))
                    }
                  />
                  <Label htmlFor={source} className="capitalize cursor-pointer">
                    {source}
                  </Label>
                </div>
              ))}
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
            disabled={creating}
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
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Twoje joby importu</CardTitle>
              <CardDescription>Ostatnie 20 jobów</CardDescription>
            </div>
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
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Brak jobów. Utwórz pierwszy powyżej.
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
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
                        <strong>Źródła:</strong> {job.sources.join(', ')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Utworzony: {new Date(job.createdAt).toLocaleString('pl-PL')}
                      </div>
                    </div>

                    {(job.status === 'running' || job.status === 'pending') && (
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
                          {job.progress.currentSource} → {job.progress.currentCategory}
                        </span>
                        <span className="font-medium">
                          {getProgressPercent(job)}%
                        </span>
                      </div>
                      <Progress value={getProgressPercent(job)} />
                      <div className="text-xs text-muted-foreground">
                        Produktów: {job.progress.importedProducts} | 
                        Kategorie: {job.progress.processedCategories}/{job.progress.totalCategories}
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
                        Błędów: {job.progress.errors.length}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
