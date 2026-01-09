"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Download,
  Upload,
  Zap,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Code,
  ListTree,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Bulk Refiner Panel Component
 * Allows admin to refine all products in database by status
 */
function BulkRefinerPanel({ authToken }: { authToken: string | null }) {
  const [status, setStatus] = useState<string>('draft');
  const [limit, setLimit] = useState<number>(100);
  const [refinementType, setRefinementType] = useState<'full_enrichment' | 'specs_cleanup'>('full_enrichment');
  const [preview, setPreview] = useState<{ totalProducts: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh logs when job is active
  useEffect(() => {
    if (!jobId || !authToken || !autoRefresh) return;

    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/admin/refiner-logs?jobId=${jobId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (data.success) {
          setLogs(data.logs || []);
        }
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [jobId, authToken, autoRefresh]);

  const fetchPreview = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const url = status === 'all' 
        ? '/api/admin/refiner/bulk'
        : `/api/admin/refiner/bulk?status=${status}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const startBulkRefinement = async () => {
    if (!authToken) return alert('Brak tokenu autoryzacji');
    if (!confirm(`⚠️ Rozpocząć refinement ${limit} produktów (status: ${status})? To może zająć kilka minut i zużyć quota AI.`)) return;

    setRunning(true);
    setJobId(null);
    try {
      const res = await fetch('/api/admin/refiner/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: status === 'all' ? undefined : status,
          limit,
          refinementType,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setJobId(data.jobId);
        alert(`✅ Bulk refinement uruchomiony!\nJob ID: ${data.jobId}\n\nMonitoruj postęp w logach.`);
      } else {
        alert(`❌ Błąd: ${data.error}`);
      }
    } catch (err: any) {
      alert(`❌ Błąd: ${err?.message || err}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Filter */}
        <div className="space-y-2">
          <Label htmlFor="refiner-status">Status produktów</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="refiner-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="draft">Draft (nieprzetworzone)</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Limit */}
        <div className="space-y-2">
          <Label htmlFor="refiner-limit">Limit (maks produktów)</Label>
          <Input
            id="refiner-limit"
            type="number"
            min={1}
            max={1000}
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
          />
        </div>

        {/* Refinement Type */}
        <div className="space-y-2">
          <Label htmlFor="refiner-type">Typ refinementu</Label>
          <Select value={refinementType} onValueChange={(v) => setRefinementType(v as any)}>
            <SelectTrigger id="refiner-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_enrichment">Full Enrichment (AI + specs)</SelectItem>
              <SelectItem value="specs_cleanup">Specs Cleanup Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview & Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={fetchPreview}
          disabled={loading}
          variant="outline"
          className="gap-2"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          Podgląd (count)
        </Button>

        <Button
          onClick={startBulkRefinement}
          disabled={running || !authToken}
          className="gap-2 bg-purple-600 hover:bg-purple-700"
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {running ? 'Uruchamianie...' : 'Uruchom Bulk Refiner'}
        </Button>

        {preview && (
          <div className="text-sm text-slate-600">
            Znaleziono: <span className="font-semibold text-slate-900">{preview.totalProducts}</span> produktów
          </div>
        )}
      </div>

      {/* Job ID Display */}
      {jobId && (
        <div className="space-y-3">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-800">
                  <span className="font-semibold">Job uruchomiony:</span> {jobId}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  {autoRefresh ? '🔴 Live monitoring włączony (odświeżanie co 5s)' : 'Włącz auto-refresh aby monitorować postęp'}
                </p>
              </div>
              <Button
                size="sm"
                variant={autoRefresh ? "destructive" : "outline"}
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", autoRefresh && "animate-spin")} />
                {autoRefresh ? 'Stop' : 'Start Auto-Refresh'}
              </Button>
            </div>
          </div>

          {/* Live Logs Display */}
          {logs.length > 0 && (
            <Card className="bg-slate-950 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Live Logs ({logs.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 w-full">
                  <div className="space-y-1 font-mono text-xs">
                    {logs.slice(0, 50).map((log, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-2 rounded",
                          log.status === 'success' && "text-green-400 bg-green-950/20",
                          log.status === 'failed' && "text-red-400 bg-red-950/20",
                          log.status === 'info' && "text-blue-400 bg-blue-950/20"
                        )}
                      >
                        <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString('pl-PL')}]</span>
                        {' '}
                        <span className="text-slate-400">{log.productId || 'system'}:</span>
                        {' '}
                        {log.message}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 space-y-1">
        <p><strong>Full Enrichment:</strong> AI opisuje produkty (multilingual), normalizuje specs, liczy quality score</p>
        <p><strong>Specs Cleanup:</strong> Tylko porządkuje specyfikacje bez wywołań AI (szybsze, tańsze)</p>
        <p><strong>UWAGA:</strong> Bulk refinement może zużyć sporo quota API Gemini przy dużych limitach!</p>
      </div>
    </div>
  );
}

interface HarvesterJob {
  id: string;
  source: "aliexpress" | "amazon" | "allegro";
  query: string;
  status: "running" | "completed" | "failed" | "paused";
  productsFound: number;
  productsCreated: number;
  dealsCreated: number;
  duplicatesSkipped: number;
  progress: number;
  startedAt: string;
  completedAt?: string;
}

export default function M6ImportDashboard() {
  const { getIdToken } = useAuth();
  const [jobs, setJobs] = useState<HarvesterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<HarvesterJob | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [killing, setKilling] = useState(false);
  const [wiping, setWiping] = useState(false);

  // Critical: Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Load admin token once on mount
  useEffect(() => {
    let cancelled = false;

    const loadToken = async () => {
      try {
        const token = await getIdToken?.();
        if (!cancelled) {
          setAuthToken(token || null);
          setAuthError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
        }
      }
    };

    loadToken();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  useEffect(() => {
    if (!authToken) return;

    loadJobs(authToken);
    const interval = setInterval(() => loadJobs(authToken), 8000);
    return () => clearInterval(interval);
  }, [authToken]);

  // Don't render anything until client is ready
  if (!mounted) {
    return null;
  }

  const loadJobs = async (token?: string) => {
    if (!token) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/harvester-jobs", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError("Brak uprawnień administratora do odczytu jobów.");
        setJobs([]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setJobs(data.jobs || []);
      setAuthError(null);
    } catch (err) {
      console.error("Error loading jobs", err);
      setAuthError("Nie udało się pobrać listy jobów (sprawdź sieć / uprawnienia)");
    } finally {
      setLoading(false);
    }
  };

  const refreshJobs = () => loadJobs(authToken || undefined);

  const killAllRunningJobs = async () => {
    if (!authToken) return setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
    if (!confirm('⚠️ Czy na pewno chcesz zatrzymać WSZYSTKIE aktywne zadania harvestera?')) return;
    setKilling(true);
    try {
      const res = await fetch('/api/admin/harvester/kill-all', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('Kill All failed');
      await refreshJobs();
      alert('✅ Zatrzymano aktywne zadania');
    } catch (e: any) {
      alert(`❌ Błąd zatrzymywania: ${e?.message || e}`);
    } finally {
      setKilling(false);
    }
  };

  const wipeDatabase = async () => {
    if (!authToken) return setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
    const c1 = confirm('⚠️⚠️⚠️ UWAGA: To USUNIE WSZYSTKIE dane (deals, product_cores, identity_matches, harvester_jobs). Kontynuować?');
    if (!c1) return;
    const c2 = confirm('🚨 OSTATNIE OSTRZEŻENIE! Operacja jest NIEODWRACALNA. Kontynuować?');
    if (!c2) return;
    setWiping(true);
    try {
      const res = await fetch('/api/admin/harvester/wipe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error('WIPE failed');
      const data = await res.json();
      await refreshJobs();
      alert(`🗑️ Wyczyszczono ${data.total} dokumentów`);
    } catch (e: any) {
      alert(`❌ Błąd WIPE: ${e?.message || e}`);
    } finally {
      setWiping(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "paused":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Zap className="w-4 h-4 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4" />;
      case "failed":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const durationInSeconds = (job: HarvesterJob) => {
    const end = new Date(job.completedAt || new Date()).getTime();
    const start = new Date(job.startedAt).getTime();
    return Math.round((end - start) / 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">M6 Import Dashboard</h1>
          </div>
          <p className="text-slate-600">
            Zarządzaj potkiem importu produktów z automatyczną deduplicacją i wzbogacaniem AI
          </p>
        </div>

        {authError && (
          <div className="p-4 border border-red-200 bg-red-50 text-red-800 rounded-lg">
            {authError}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Aktywne joby</p>
                <p className="text-3xl font-bold text-slate-900">
                  {jobs.filter((j) => j.status === "running").length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Ukończonych</p>
                <p className="text-3xl font-bold text-green-600">
                  {jobs.filter((j) => j.status === "completed").length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Produktów razem</p>
                <p className="text-3xl font-bold text-blue-600">
                  {jobs.reduce((sum, j) => sum + j.productsCreated, 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Duplikatów pominięto</p>
                <p className="text-3xl font-bold text-amber-600">
                  {jobs.reduce((sum, j) => sum + j.duplicatesSkipped, 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Refiner Panel */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-600" />
              Bulk AI Refiner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BulkRefinerPanel authToken={authToken} />
          </CardContent>
        </Card>

        {/* Danger Controls (Kill All / WIPE) */}
        <Card className="bg-white border-2 border-red-200">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-red-700">Strefa krytyczna</h3>
                <p className="text-sm text-slate-600">
                  Szybkie akcje administracyjne dla harvestera (M6): zatrzymanie aktywnych jobów i pełny WIPE bazy importu.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {jobs.some(j => j.status === 'running') && (
                  <Button
                    variant="destructive"
                    onClick={killAllRunningJobs}
                    disabled={killing}
                    className="gap-2"
                  >
                    {killing ? 'Zatrzymywanie…' : (<><Zap className="w-4 h-4" /> Kill All</>)}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={wipeDatabase}
                  disabled={wiping}
                  className="gap-2 bg-red-600 hover:bg-red-700"
                >
                  {wiping ? 'Czyszczenie…' : (<><Trash2 className="w-4 h-4" /> WIPE ALL</>)}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList className="bg-white border">
            <TabsTrigger value="jobs" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Historia jobów
            </TabsTrigger>
            <TabsTrigger value="harvester" className="gap-2">
              <Download className="w-4 h-4" />
              Nowy Harvester
            </TabsTrigger>
            <TabsTrigger value="refiner" className="gap-2">
              <Zap className="w-4 h-4" />
              AI Refiner
            </TabsTrigger>
            <TabsTrigger value="monitor" className="gap-2">
              <Code className="w-4 h-4" />
              Live Monitor
            </TabsTrigger>
          </TabsList>

          {/* TAB: Historia jobów */}
          <TabsContent value="jobs" className="space-y-4">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Ostatnie joby importu</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshJobs}
                    className="gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Odśwież
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Ładowanie...</div>
                ) : jobs.length === 0 ? (
                  <div className="text-center py-8 text-slate-600">
                    Brak jobów. Uruchom pierwszy import!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <Badge className={getStatusColor(job.status)}>
                                <span className="mr-1">
                                  {getStatusIcon(job.status)}
                                </span>
                                {job.status}
                              </Badge>
                              <span className="font-mono text-sm text-slate-600">
                                {job.id.slice(0, 12)}...
                              </span>
                              <span className="text-sm text-slate-500">
                                {new Date(job.startedAt).toLocaleString("pl-PL")}
                              </span>
                            </div>

                            <p className="text-sm">
                              <span className="font-semibold">{job.source}</span>
                              {" → "}
                              <span className="text-slate-600">
                                "{job.query}"
                              </span>
                            </p>

                            {/* Progress bar */}
                            {job.status === "running" && (
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${job.progress}%` }}
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-4 gap-4 pt-2">
                              <div>
                                <p className="text-xs text-slate-500">Znalezione</p>
                                <p className="font-semibold text-slate-900">
                                  {job.productsFound}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Nowe produkty</p>
                                <p className="font-semibold text-green-600">
                                  {job.productsCreated}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Nowe Deale</p>
                                <p className="font-semibold text-blue-600">
                                  {job.dealsCreated}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500">Czas</p>
                                <p className="font-semibold text-slate-900">
                                  {durationInSeconds(job)}s
                                </p>
                              </div>
                            </div>
                          </div>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedJob(job)}
                              >
                                Szczegóły
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Job {job.id}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-slate-600">
                                      Status
                                    </p>
                                    <Badge
                                      className={getStatusColor(job.status)}
                                    >
                                      {job.status}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="text-sm text-slate-600">
                                      Source
                                    </p>
                                    <p className="font-mono">
                                      {job.source}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-slate-600">
                                      Query
                                    </p>
                                    <p className="font-mono">{job.query}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-slate-600">
                                      ID
                                    </p>
                                    <p className="font-mono text-xs">
                                      {job.id}
                                    </p>
                                  </div>
                                </div>

                                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                  <h4 className="font-semibold text-slate-900">
                                    Wyniki
                                  </h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-slate-600">
                                        Produktów znalezionych
                                      </p>
                                      <p className="text-lg font-semibold">
                                        {job.productsFound}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-600">
                                        Nowych produktów
                                      </p>
                                      <p className="text-lg font-semibold text-green-600">
                                        {job.productsCreated}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-600">
                                        Nowych Deali
                                      </p>
                                      <p className="text-lg font-semibold text-blue-600">
                                        {job.dealsCreated}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-600">
                                        Duplikatów pominięto
                                      </p>
                                      <p className="text-lg font-semibold text-amber-600">
                                        {job.duplicatesSkipped}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Nowy Harvester */}
          <TabsContent value="harvester">
            <div className="space-y-4">
              <HarvesterWizard
                onJobCreated={refreshJobs}
                authToken={authToken}
                setAuthError={setAuthError}
              />
              <CategoryTreeBuilder
                authToken={authToken}
                onFinished={refreshJobs}
                setAuthError={setAuthError}
              />
            </div>
          </TabsContent>

          {/* TAB: AI Refiner */}
          <TabsContent value="refiner">
            <RefinerPanel
              onJobCreated={refreshJobs}
              authToken={authToken}
              setAuthError={setAuthError}
            />
          </TabsContent>

          {/* TAB: Live Monitor */}
          <TabsContent value="monitor">
            <LiveMonitor authToken={authToken} setAuthError={setAuthError} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ==================== CATEGORY TREE BUILDER ==================== */
function CategoryTreeBuilder({
  authToken,
  onFinished,
  setAuthError,
}: {
  authToken: string | null;
  onFinished?: () => void;
  setAuthError: (message: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleBuild = async () => {
    if (!authToken) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      setResult("❌ Brak tokenu administratora");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/categories/auto-build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError("Brak uprawnień administratora do budowania kategorii.");
        setResult("❌ Brak uprawnień administratora");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setResult(`❌ ${data.error || "Nie udało się zbudować drzewka"}`);
        return;
      }

      const summary = data.message ||
        `✅ Zbudowano ${data.categories ?? data.mainCount ?? 0} kategorii, ${data.subcategories ?? data.subCount ?? 0} podkategorii, ${data.subSubcategories ?? data.subSubCount ?? 0} pod-podkategorii (EN slug + EN description).`;
      setResult(summary);
      setAuthError(null);
      onFinished?.();
    } catch (err) {
      setResult(`❌ ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTree className="w-5 h-5 text-green-600" />
          Drzewko kategorii (3 poziomy)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-700">
          Zbuduj pełne drzewko kategorii M6 (slug i description w EN, tłumaczenia dodasz później). Uwzględnia podkategorie i pod-podkategorie.
        </p>

        <Button
          onClick={handleBuild}
          disabled={loading}
          className="w-full gap-2 bg-green-600 hover:bg-green-700"
          size="lg"
        >
          {loading ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Budowanie...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Zbuduj EN slug + EN description
            </>
          )}
        </Button>

        {result && (
          <div
            className={`p-4 rounded-lg border-2 text-sm ${
              result.startsWith("✅")
                ? "border-green-300 bg-green-50 text-green-800"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {result}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ==================== HARVESTER WIZARD ==================== */
function HarvesterWizard({
  onJobCreated,
  authToken,
  setAuthError,
}: {
  onJobCreated: () => void;
  authToken: string | null;
  setAuthError: (message: string | null) => void;
}) {
  const [source, setSource] = useState<"aliexpress" | "amazon" | "allegro">(
    "aliexpress"
  );
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [useCategoryTree, setUseCategoryTree] = useState(false);
  const [rootCategorySlug, setRootCategorySlug] = useState("");

  const handleRun = async () => {
    if (!useCategoryTree && !query.trim()) return;
    if (!authToken) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      setResult({ error: "Brak tokenu administratora" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const payload: Record<string, any> = {
        source,
        query: query.trim() || "category-tree",
        maxResults,
      };

      if (useCategoryTree) {
        payload.mode = "category-tree";
        if (rootCategorySlug.trim()) {
          payload.rootCategorySlug = rootCategorySlug.trim();
        }
      }

      const res = await fetch("/api/admin/harvester/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError("Brak uprawnień administratora do uruchomienia harvestera.");
        setResult({ error: "Brak uprawnień administratora" });
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResult(data);
      onJobCreated();
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5 text-blue-600" />
          Uruchom Harvester
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Source selection */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-900">
            1. Wybierz źródło
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(["aliexpress", "amazon", "allegro"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`p-4 rounded-lg border-2 transition-all font-semibold capitalize ${
                  source === s
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Query input */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-900">
            2. Wpisz szukany termin
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="np. USB-C Cable, Gaming Laptop, Wireless Headphones..."
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyPress={(e) => e.key === "Enter" && handleRun()}
          />
          <p className="text-xs text-slate-500">
            Zostanie przesłany do API i automatycznie zdeduplicirowany
          </p>
        </div>

        <div className="space-y-2 border border-slate-200 rounded-lg p-4 bg-slate-50">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <input
              type="checkbox"
              checked={useCategoryTree}
              onChange={(e) => setUseCategoryTree(e.target.checked)}
            />
            Iteruj całe drzewo kategorii (3 poziomy, slug/description w EN)
          </label>
          <p className="text-xs text-slate-600">
            Pobierze wszystkie pod- i pod-podkategorie z Firestore (EN slug + EN description). Jeśli drzewko nie istnieje, najpierw zbuduj je poniżej.
          </p>
          {useCategoryTree && (
            <div className="space-y-2 pl-1 md:pl-2">
              <label className="block text-xs font-semibold text-slate-700">
                Opcjonalny główny slug (angielski)
              </label>
              <input
                type="text"
                value={rootCategorySlug}
                onChange={(e) => setRootCategorySlug(e.target.value)}
                placeholder="np. electronics"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-[11px] text-slate-500">
                Pozostaw puste aby ziterować wszystkie główne kategorie. Slugi są po angielsku, opisy w EN (tłumaczenia dodasz później).
              </p>
            </div>
          )}
        </div>

        {/* Step 3: Max results */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-slate-900">
            3. Max rezultatów: {maxResults}
          </label>
          <input
            type="range"
            min="10"
            max="200"
            value={maxResults}
            onChange={(e) => setMaxResults(parseInt(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-slate-500">
            Więcej = dokładniej, ale wolniej (~2 sec na 50 produktów)
          </p>
        </div>

        {/* Action button */}
        <Button
          onClick={handleRun}
          disabled={(!useCategoryTree && !query.trim()) || loading}
          size="lg"
          className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Pobieranie...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Uruchom Harvester
            </>
          )}
        </Button>

        {/* Result */}
        {result && (
          <div
            className={`p-4 rounded-lg border-2 space-y-2 ${
              result.error
                ? "border-red-300 bg-red-50"
                : "border-green-300 bg-green-50"
            }`}
          >
            <p className="font-semibold text-slate-900">
              {result.error ? "❌ Błąd" : "✅ Sukces!"}
            </p>
            <pre className="text-xs overflow-auto bg-white rounded p-2 border">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ==================== REFINER PANEL ==================== */
function RefinerPanel({
  onJobCreated,
  authToken,
  setAuthError,
}: {
  onJobCreated: () => void;
  authToken: string | null;
  setAuthError: (message: string | null) => void;
}) {
  const [productIds, setProductIds] = useState("");
  const [refinationType, setRefinationType] = useState<"full_enrichment" | "specs_cleanup">(
    "full_enrichment"
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRun = async () => {
    if (!productIds.trim()) return;
    if (!authToken) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      setResult({ error: "Brak tokenu administratora" });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const ids = productIds
        .split("\n")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      const res = await fetch("/api/admin/refiner/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ productIds: ids, refinationType }),
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError("Brak uprawnień administratora do uruchomienia refinera.");
        setResult({ error: "Brak uprawnień administratora" });
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResult(data);
      onJobCreated();
    } catch (err) {
      setResult({ error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-600" />
          AI Refiner - Wzbogacanie produktów
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-900">
            Co robi AI Refiner?
          </p>
          <ul className="text-sm text-amber-800 mt-2 space-y-1 ml-4 list-disc">
            <li>Czyszcze specs z surowych danych</li>
            <li>Generuje opisy wielojęzyczne (PL/EN/DE) via Gemini</li>
            <li>Tworzy tagi wyszukiwania</li>
            <li>Oblicza quality score (0-100)</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Typ wzbogacania
            </label>
            <div className="space-y-2">
              {(
                ["full_enrichment", "specs_cleanup"] as const
              ).map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="refinement"
                    value={type}
                    checked={refinationType === type}
                    onChange={(e) =>
                      setRefinationType(
                        e.target.value as typeof refinationType
                      )
                    }
                  />
                  <span className="font-medium capitalize">
                    {type.replace(/_/g, " ")}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              ID produktów (jedno na linię)
            </label>
            <textarea
              value={productIds}
              onChange={(e) => setProductIds(e.target.value)}
              placeholder="Wklej ID produktów - jedno ID na linię&#10;Przykład: prod_abc123"
              className="w-full h-40 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 font-mono"
            />
          </div>
        </div>

        <Button
          onClick={handleRun}
          disabled={!productIds.trim() || loading}
          size="lg"
          className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
        >
          {loading ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Wzbogacanie...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Uruchom Refiner
            </>
          )}
        </Button>

        {result && (
          <div
            className={`p-4 rounded-lg border-2 space-y-2 ${
              result.error
                ? "border-red-300 bg-red-50"
                : "border-green-300 bg-green-50"
            }`}
          >
            <p className="font-semibold text-slate-900">
              {result.error ? "❌ Błąd" : "✅ Sukces!"}
            </p>
            <pre className="text-xs overflow-auto bg-white rounded p-2 border">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ==================== LIVE MONITOR ==================== */
function LiveMonitor({
  authToken,
  setAuthError,
}: {
  authToken: string | null;
  setAuthError: (message: string | null) => void;
}) {
  const [code, setCode] = useState(`// Przykład: Szybki test harvestera
const harvester = new SmartHarvester('test-job-123');
const result = await harvester.harvestProducts('aliexpress', 'USB-C Cable', 50);

console.log('Results:', result);
// {
//   productsFound: 50,
//   productsCreated: 12,
//   dealsCreated: 38,
//   duplicatesSkipped: 0
// }`);
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    if (!authToken) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      setOutput(["Brak tokenu administratora"]);
      return;
    }

    setRunning(true);
    setOutput([]);
    try {
      const res = await fetch("/api/admin/execute-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ code }),
      });

      if (res.status === 401 || res.status === 403) {
        setAuthError("Brak uprawnień administratora do wykonania kodu.");
        setOutput(["Brak uprawnień administratora"]);
        setRunning(false);
        return;
      }

      const data = await res.json();
      setOutput(data.logs || []);
    } catch (err) {
      setOutput([(err as Error).message]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 h-96">
      {/* Editor */}
      <Card className="bg-white border-0 shadow-sm overflow-hidden flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Code Playground</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full font-mono text-sm resize-none border rounded p-2 focus:ring-2 focus:ring-blue-500"
          />
        </CardContent>
        <div className="border-t p-4">
          <Button
            onClick={handleRun}
            disabled={running}
            className="w-full gap-2"
            size="sm"
          >
            {running ? <Play className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4" />}
            {running ? "Wykonywanie..." : "Wykonaj"}
          </Button>
        </div>
      </Card>

      {/* Output */}
      <Card className="bg-white border-0 shadow-sm overflow-hidden flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Wynik</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto bg-slate-950 rounded text-slate-100 font-mono text-xs p-3 space-y-1">
          {output.length === 0 ? (
            <span className="text-slate-500">Czekam na wynik...</span>
          ) : (
            output.map((line, i) => (
              <div key={i}>{line}</div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
