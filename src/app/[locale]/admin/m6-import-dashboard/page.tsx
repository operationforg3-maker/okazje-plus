"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/unified-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  AlertTriangle,
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
  type?: 'import'; // Optional for backward compatibility
  source: "aliexpress" | "amazon" | "allegro" | "convertiser";
  query: string;
  status: "running" | "completed" | "failed" | "paused";
  productsFound: number;
  productsCreated: number;
  dealsCreated: number;
  duplicatesSkipped: number;
  progress: number;
  startedAt: string;
  completedAt?: string;
  currentCategory?: string;
  totalCategories?: number;
  processedCategories?: Array<{
    category: string;
    count: number;
    status: 'ok' | 'error';
  }>;
}

interface RefinerJob {
  id: string;
  type: 'refiner';
  status: "running" | "completed" | "failed" | "paused";
  refinationType: string;
  productsProcessed: number;
  productsSuccessful: number;
  productsFailed: number;
  startedAt: string;
  completedAt?: string;
}

// --- Tree Viewer Component ---
interface CategoryNode {
  name: string;
  fullPath: string;
  count: number;
  status: 'ok' | 'error' | 'pending';
  children: Record<string, CategoryNode>;
  totalProductsInSubtree: number;
}

function JobCategoryTree({ categories }: { categories: NonNullable<HarvesterJob['processedCategories']> }) {
  // 1. Build Tree
  const root: Record<string, CategoryNode> = {};
  
  categories.forEach(cat => {
    const parts = cat.category.split('/');
    let currentLevel = root;
    
    parts.forEach((part, idx) => {
      if (!currentLevel[part]) {
        currentLevel[part] = {
          name: part,
          fullPath: parts.slice(0, idx + 1).join('/'),
          count: 0,
          status: 'pending', // Default
          children: {},
          totalProductsInSubtree: 0
        };
      }
      
      // If leaf (matches processed item)
      if (idx === parts.length - 1) {
        currentLevel[part].count = cat.count;
        currentLevel[part].status = cat.status;
      }
      
      currentLevel = currentLevel[part].children;
    });
  });

  // 2. Aggregate counts (recursive)
  const calculateTotals = (nodes: Record<string, CategoryNode>): number => {
    let sum = 0;
    Object.values(nodes).forEach(node => {
      const childSum = calculateTotals(node.children);
      node.totalProductsInSubtree = node.count + childSum;
      sum += node.totalProductsInSubtree;
    });
    return sum;
  };
  calculateTotals(root);

  // 3. Render
  return (
    <div className="bg-white min-h-0">
      <div className="p-2">
        {Object.values(root).map((node) => (
          <TreeNode key={node.fullPath} node={node} level={0} />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ node, level }: { node: CategoryNode, level: number }) {
  const [isOpen, setIsOpen] = useState(level < 1); // Open root level by default
  const hasChildren = Object.keys(node.children).length > 0;
  
  // Choose which count to display:
  // If no children (leaf), show direct count.
  // If children (branch), show total subtree count.
  const displayCount = hasChildren ? node.totalProductsInSubtree : node.count;

  return (
    <div className="text-sm">
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-50 cursor-pointer select-none transition-colors",
          level > 0 && "ml-4 border-l-2 border-slate-100 pl-2"
        )}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        <div className={cn("w-4 h-4 flex items-center justify-center text-slate-400 transition-transform duration-200", !hasChildren && "opacity-0", isOpen && "rotate-90")}>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
        
        <span className={cn("font-mono text-slate-700 truncate", level === 0 && "font-bold text-slate-900")}>
          {node.name}
        </span>
        
        <div className="flex-1 border-b border-slate-100 border-dashed mx-2 opacity-50" />
        
        <div className="flex items-center gap-2 text-xs">
          {/* Display simplified status only for leaves */}
          {!hasChildren && (
            <span className={cn(
              "w-2 h-2 rounded-full",
              node.status === 'ok' && "bg-green-500",
              node.status === 'error' && "bg-red-500",
              node.status === 'pending' && "bg-slate-300"
            )} />
          )}

          {/* Count Badge */}
          <span className={cn(
            "font-mono px-2 py-0.5 rounded text-[11px]",
            hasChildren ? "bg-slate-100 text-slate-600 font-semibold" : "bg-blue-50 text-blue-700 font-bold"
          )}>
            {displayCount} szt.
          </span>
        </div>
      </div>
      
      {isOpen && hasChildren && (
        <div className="border-l-2 border-slate-100 ml-3 pl-1">
          {Object.values(node.children).map(child => (
            <TreeNode key={child.fullPath} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function M6ImportDashboard() {
  const { getIdToken, user } = useAuth();
  const [jobs, setJobs] = useState<HarvesterJob[]>([]);
  const [refinerJobs, setRefinerJobs] = useState<RefinerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<HarvesterJob | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [killing, setKilling] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<{ products: number; deals: number; draft: number } | null>(null);

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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-slate-600">Ładowanie panelu importu...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const loadJobs = async (token?: string) => {
    if (!token) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      setLoading(false);
      return;
    }

    try {
      // Fetch Harvester Jobs
      const resHarvester = await fetch("/api/admin/harvester-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resHarvester.status === 401 || resHarvester.status === 403) {
        setAuthError("Brak uprawnień (403/401) do odczytu jobów.");
        setJobs([]);
        setRefinerJobs([]);
        setLoading(false);
        return;
      }
      
      if (!resHarvester.ok) {
         console.error('Harvester fetch failed:', resHarvester.status, resHarvester.statusText);
      } else {
        const dataHarvester = await resHarvester.json();
        setJobs(dataHarvester.jobs || []);
      }

      // Fetch Refiner Jobs
      const resRefiner = await fetch("/api/admin/refiner-jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (resRefiner.status === 401 || resRefiner.status === 403) {
        // Already handled above or ignore
      } else if (resRefiner.ok) {
        const dataRefiner = await resRefiner.json();
        setRefinerJobs(dataRefiner.jobs || []);
      }

      // Fetch Pending Counts (Moderation)
      const resPending = await fetch("/api/admin/pending-counts", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resPending.ok) {
        const dataPending = await resPending.json();
        setPendingCounts({
          products: dataPending.pendingProducts || 0,
          deals: dataPending.pendingDeals || 0,
          draft: dataPending.draftProducts || 0,
        });
      }

      setAuthError(null);
    } catch (err) {
      console.error("Error loading jobs", err);
      setAuthError(`Błąd pobierania danych: ${(err as Error).message}`);
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
            <p className="font-bold">Błąd: {authError}</p>
            {user && (
               <div className="mt-2 text-xs text-red-700 font-mono space-y-1">
                 <p>Zalogowany jako: {user.email}</p>
                 <p>UID: {user.uid}</p>
                 <p>Role: {user.role || 'user'}</p>
                 <p className="mt-2 font-bold">⚠️ Spróbuj się wylogować i zalogować ponownie, aby odświeżyć uprawnienia.</p>
               </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Aktywne joby</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900">
                    {jobs.filter((j) => j.status === "running").length + refinerJobs.filter((j) => j.status === "running").length + (wiping ? 1 : 0)}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 text-xs text-slate-500 mt-1">
                  <div className="flex justify-between">
                    <span>Import:</span>
                    <span className="font-mono font-medium text-slate-700">{jobs.filter((j) => j.status === "running").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Refiner:</span>
                    <span className="font-mono font-medium text-slate-700">{refinerJobs.filter((j) => j.status === "running").length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Depopulacja:</span>
                    <span className="font-mono font-medium text-slate-700">{wiping ? 1 : 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Ukończonych</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-green-600">
                   {jobs.filter((j) => j.status === "completed").length + refinerJobs.filter((j) => j.status === "completed").length}
                  </p>
                </div>
                <div className="flex gap-2 text-xs text-slate-500 mt-1">
                   <span>Import: {jobs.filter((j) => j.status === "completed").length}</span>
                   <span>Refiner: {refinerJobs.filter((j) => j.status === "completed").length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Produkty (Import)</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-blue-600">
                    {jobs.reduce((sum, j) => sum + (j.productsCreated || 0), 0)}
                  </p>
                  <span className="text-xs text-slate-400">total</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                   Znaleziono: {jobs.reduce((sum, j) => sum + (j.productsFound || 0), 0)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
               <div className="space-y-2">
                <p className="text-sm text-slate-600">Okazje (Deals)</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-purple-600">
                    {jobs.reduce((sum, j) => sum + (j.dealsCreated || 0), 0)}
                  </p>
                  <span className="text-xs text-slate-400">total</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Nowe oferty (M6)
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                   <p className="text-sm text-slate-600">Pominięte duplikaty</p>
                   <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Podejrzyj duplikaty" onClick={() => setShowDuplicatesDialog(true)}>
                     <Eye className="w-4 h-4 text-slate-500 hover:text-amber-600" />
                   </Button>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-amber-600">
                    {jobs.reduce((sum, j) => sum + (j.duplicatesSkipped || 0), 0)}
                  </p>
                </div>
                 <div className="text-xs text-slate-500 mt-1">
                  Dopasowane do istniejących
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-orange-400">
            <CardContent className="pt-6">
              <div className="space-y-2">
                 <div className="flex gap-2 items-center text-orange-600">
                    <AlertTriangle className="w-4 h-4" />
                    <p className="text-sm font-semibold">Do moderacji</p>
                 </div>
                 
                 {pendingCounts ? (
                    <div className="space-y-1 mt-1">
                       <div className="flex justify-between items-baseline">
                          <span className="text-xs text-slate-600">Produkty:</span>
                          <span className="text-2xl font-bold text-slate-800">{pendingCounts.products}</span>
                       </div>
                       <div className="flex justify-between items-baseline pt-1 border-t border-dashed">
                          <span className="text-xs text-slate-600">Okazje:</span>
                          <span className="text-xl font-bold text-slate-700">{pendingCounts.deals}</span>
                       </div>
                       <div className="flex justify-between items-baseline pt-1 border-t border-dashed">
                          <span className="text-xs text-slate-400">Draft:</span>
                          <span className="text-sm font-mono text-slate-500">{pendingCounts.draft}</span>
                       </div>
                    </div>
                 ) : (
                    <div className="h-20 flex items-center justify-center">
                       <div className="animate-spin w-5 h-5 border-2 border-orange-200 border-t-orange-500 rounded-full" />
                    </div>
                 )}
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
            <TabsTrigger value="moderation" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Moderacja
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
                      <JobItem key={job.id} job={job} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Nowy Harvester */}
          <TabsContent value="harvester">
            <div className="space-y-4">
              {/* Convertiser Auto-Browse */}
              <ConvertiserAutoBrowsePanel
                onJobCreated={refreshJobs}
                authToken={authToken}
                setAuthError={setAuthError}
              />
              
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

          {/* TAB: Moderacja */}
          <TabsContent value="moderation">
            <ModerationPanel
              authToken={authToken}
              setAuthError={setAuthError}
              onModerated={refreshJobs}
            />
          </TabsContent>

          {/* TAB: Live Monitor */}
          <TabsContent value="monitor">
            <LiveMonitor authToken={authToken} setAuthError={setAuthError} />
          </TabsContent>
        </Tabs>
      </div>

      <DuplicatesOverviewDialog 
         open={showDuplicatesDialog} 
         onOpenChange={setShowDuplicatesDialog}
         jobs={jobs}
      />
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

/* ==================== CONVERTISER AUTO-BROWSE PANEL ==================== */
function ConvertiserAutoBrowsePanel({
  onJobCreated,
  authToken,
  setAuthError,
}: {
  onJobCreated: () => void;
  authToken: string | null;
  setAuthError: (message: string | null) => void;
}) {
  const [isImporting, setIsImporting] = useState(false);
  const [maxResults, setMaxResults] = useState(10000);
  const [convertiserMode, setConvertiserMode] = useState<'products' | 'offers'>('offers');
  const [progress, setProgress] = useState<{
    jobId?: string;
    productsFound?: number;
    productsCreated?: number;
    dealsCreated?: number;
    status?: string;
    error?: string;
  }>({});

  const handleAutoImport = async () => {
    if (!authToken) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      return;
    }

    try {
      setIsImporting(true);
      setProgress({});

      const response = await fetch('/api/admin/harvester/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          source: 'convertiser',
          query: '',
          maxResults,
          convertiserMode,
          autoBrowse: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to start auto-import');
      }

      const jobId = data.job?.id;
      if (!jobId) {
        throw new Error('No job ID returned');
      }

      setProgress({ jobId, status: 'running' });

      // Poll for job status every 5 seconds
      let pollAttempts = 0;
      const maxPollAttempts = 12; // ~1 min
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/admin/harvester-jobs?jobId=${jobId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });

          if (statusResponse.status === 401 || statusResponse.status === 403) {
            clearInterval(pollInterval);
            setProgress(prev => ({
              ...prev,
              status: 'failed',
              error: 'Brak uprawnień (401/403) do odczytu statusu joba.',
            }));
            setIsImporting(false);
            return;
          }

          const statusData = await statusResponse.json();

          if (!statusData.success || !statusData.job) {
            pollAttempts += 1;

            // Fallback: spróbuj pobrać listę i znaleźć job po ID
            const listResponse = await fetch('/api/admin/harvester-jobs?limit=50', {
              headers: { Authorization: `Bearer ${authToken}` },
            });

            if (listResponse.ok) {
              const listData = await listResponse.json();
              const fallbackJob = (listData.jobs || []).find((j: any) => j.id === jobId);
              if (fallbackJob) {
                setProgress({
                  jobId,
                  productsFound: fallbackJob.productsFound || 0,
                  productsCreated: fallbackJob.productsCreated || 0,
                  dealsCreated: fallbackJob.dealsCreated || 0,
                  status: fallbackJob.status,
                });

                if (fallbackJob.status === 'completed' || fallbackJob.status === 'failed') {
                  clearInterval(pollInterval);
                  setIsImporting(false);
                  onJobCreated();
                }
                return;
              }
            }

            if (pollAttempts <= maxPollAttempts) {
              setProgress(prev => ({
                ...prev,
                status: 'running',
                error: 'Czekam na zapis joba w bazie...'
              }));
              return;
            }

            clearInterval(pollInterval);
            setProgress(prev => ({
              ...prev,
              status: 'failed',
              error: statusData.error || 'Nie udało się pobrać statusu joba.'
            }));
            setIsImporting(false);
            return;
          }

          const job = statusData.job;
          setProgress({
            jobId,
            productsFound: job.productsFound || 0,
            productsCreated: job.productsCreated || 0,
            dealsCreated: job.dealsCreated || 0,
            status: job.status,
          });

          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollInterval);
            setIsImporting(false);
            onJobCreated();
          }
        } catch (pollError) {
          console.error('Failed to poll job status:', pollError);
          clearInterval(pollInterval);
          setProgress(prev => ({
            ...prev,
            status: 'failed',
            error: 'Błąd sieci podczas odczytu statusu joba.'
          }));
          setIsImporting(false);
        }
      }, 5000);

    } catch (error) {
      console.error('Auto-import error:', error);
      setProgress(prev => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      setIsImporting(false);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Download className="text-white" size={20} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                🚀 Auto Import - Convertiser
                <Badge className="bg-purple-600">NOWE</Badge>
              </CardTitle>
              <p className="text-xs text-slate-600 mt-1">
                Pobierz WSZYSTKIE produkty z katalogu Convertiser (21k+ items) bez słów kluczowych
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="max-results">Max Results</Label>
            <Input
              id="max-results"
              type="number"
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value) || 10000)}
              min={1000}
              max={50000}
              step={1000}
              disabled={isImporting}
              className="w-full"
            />
            <p className="text-xs text-slate-500">Maksymalna liczba produktów (1000-50000)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mode">Mode</Label>
            <Select value={convertiserMode} onValueChange={(v) => setConvertiserMode(v as 'products' | 'offers')} disabled={isImporting}>
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="offers">Offers (tracking links)</SelectItem>
                <SelectItem value="products">Products</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Offers generuje tracking linki</p>
          </div>
        </div>

        {/* Progress Display */}
        {progress.status && (
          <div className="p-4 bg-white rounded-lg border-2 border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              {progress.status === 'running' && (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full" />
                  <span className="font-semibold text-gray-900">⏳ Import w toku...</span>
                </>
              )}
              {progress.status === 'completed' && (
                <>
                  <CheckCircle2 className="text-green-600" size={20} />
                  <span className="font-semibold text-green-900">✅ Import zakończony!</span>
                </>
              )}
              {progress.status === 'failed' && (
                <>
                  <AlertCircle className="text-red-600" size={20} />
                  <span className="font-semibold text-red-900">❌ Import nie powiódł się</span>
                </>
              )}
            </div>

            {progress.jobId && (
              <p className="text-xs text-gray-500 mb-3">Job ID: {progress.jobId}</p>
            )}

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-blue-50 rounded p-2">
                <div className="text-blue-600 font-medium text-xs">Znaleziono</div>
                <div className="text-2xl font-bold text-blue-900">{progress.productsFound || 0}</div>
              </div>
              <div className="bg-green-50 rounded p-2">
                <div className="text-green-600 font-medium text-xs">Produkty</div>
                <div className="text-2xl font-bold text-green-900">{progress.productsCreated || 0}</div>
              </div>
              <div className="bg-purple-50 rounded p-2">
                <div className="text-purple-600 font-medium text-xs">Oferty</div>
                <div className="text-2xl font-bold text-purple-900">{progress.dealsCreated || 0}</div>
              </div>
            </div>

            {progress.error && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {progress.error}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={handleAutoImport}
          disabled={isImporting}
          size="lg"
          className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
        >
          {isImporting ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Importowanie...
            </>
          ) : (
            <>
              <Download size={20} />
              Uruchom Auto Import
            </>
          )}
        </Button>

        {/* Info */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 space-y-2">
          <div className="font-semibold">📋 Jak to działa:</div>
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>Paginacja:</strong> Pobiera katalog Convertisera (100 items/strona)</li>
            <li><strong>Deduplikacja:</strong> Automatycznie unika duplikatów</li>
            <li><strong>AI Kategoryzacja:</strong> Przypisuje kategorie batch processing</li>
            <li><strong>Wzbogacanie:</strong> Deal-Refiner dodaje opisy i normalizuje specs</li>
            <li><strong>Asynchroniczne:</strong> Wszystko w tle - możesz zamknąć przeglądarkę!</li>
          </ul>
        </div>
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
  const [source, setSource] = useState<"aliexpress" | "amazon" | "allegro" | "convertiser">(
    "convertiser"
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
          <div className="grid grid-cols-4 gap-3">
            {(["convertiser", "aliexpress", "amazon", "allegro"] as const).map((s) => (
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

/* ==================== MODERATION PANEL ==================== */
function ModerationPanel({
  authToken,
  setAuthError,
  onModerated,
}: {
  authToken: string | null;
  setAuthError: (message: string | null) => void;
  onModerated?: () => void;
}) {
  const { formatPrice } = useCurrency();
  const [draftProducts, setDraftProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<any>(null);

  // Load draft products on mount
  useEffect(() => {
    if (authToken) {
      loadDraftProducts();
    }
  }, [authToken]);

  const loadDraftProducts = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products/drafts', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDraftProducts(data.products || []);
      } else if (res.status !== 401 && res.status !== 403) {
        setAuthError(`Błąd pobierania produktów: ${res.status}`);
      }
    } catch (err) {
      console.error('Error loading draft products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === draftProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(draftProducts.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleApprove = async () => {
    if (selectedIds.size === 0) return;
    if (!authToken) {
      setAuthError('Brak tokenu administratora');
      return;
    }

    setProcessing(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/products/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ productIds: Array.from(selectedIds) }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: data.message,
          approved: data.results.approved,
          failed: data.results.failed,
        });
        setSelectedIds(new Set());
        await loadDraftProducts();
        onModerated?.();
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (err) {
      setResult({ success: false, error: (err as Error).message });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (selectedIds.size === 0) return;
    if (!authToken) {
      setAuthError('Brak tokenu administratora');
      return;
    }

    if (!confirm(`Czy na pewno chcesz odrzucić ${selectedIds.size} produktów?`)) return;

    setProcessing(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/moderation/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          items: Array.from(selectedIds).map(id => ({ id, type: 'product' })),
          action: 'reject',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          message: data.message,
        });
        setSelectedIds(new Set());
        await loadDraftProducts();
      } else {
        setResult({ success: false, error: data.message });
      }
    } catch (err) {
      setResult({ success: false, error: (err as Error).message });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Moderacja produktów (Draft)
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDraftProducts}
            disabled={loading}
            className="gap-2"
            aria-label="Odśwież listę produktów do moderacji"
            title="Pobierz najnowszą listę produktów"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Odśwież
          </Button>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Przejrzyj i zatwierdź produkty z harvestera, zanim trafią do Refinera AI
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-slate-600" role="status" aria-live="polite" aria-busy="true">
            Ładowanie produktów...
          </div>
        ) : draftProducts.length === 0 ? (
          <div className="text-center py-8 text-slate-600" role="status" aria-live="polite">
            ✅ Brak produktów do moderacji! Wszystkie zostały zatwierdzone.
          </div>
        ) : (
          <>
            {/* Selection toolbar */}
            <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200" role="toolbar" aria-label="Narzędzia moderacji">
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={selectedIds.size === draftProducts.length && draftProducts.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded"
                  aria-label="Zaznacz wszystkie produkty"
                  title="Zaznacz lub odznacz wszystkie produkty na tej stronie"
                />
                <span aria-live="polite">Zaznacz wszystkie ({selectedIds.size}/{draftProducts.length})</span>
              </label>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleApprove}
                  disabled={selectedIds.size === 0 || processing}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  aria-label={selectedIds.size === 0 ? 'Zatwierdź (brak wybranych produktów)' : `Zatwierdź ${selectedIds.size} wybranych produktów`}
                  title="Zatwierdź wybrane produkty i dodaj do systemu"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
                      <span aria-live="polite">Zatwierdzanie...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Zatwierdź ({selectedIds.size})</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleReject}
                  disabled={selectedIds.size === 0 || processing}
                  className="gap-2"
                  aria-label={selectedIds.size === 0 ? 'Odrzuć (brak wybranych produktów)' : `Odrzuć ${selectedIds.size} wybranych produktów`}
                  title="Odrzuć wybrane produkty"
                >
                  <span>Odrzuć ({selectedIds.size})</span>
                </Button>
              </div>
            </div>

            {/* Products list */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto border rounded-lg p-2" role="list" aria-label="Lista produktów do moderacji">
              {draftProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition"
                  role="listitem"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    className="w-4 h-4 rounded mt-1"
                    aria-label={`Wybierz produkt: ${product.title?.pl || product.title || 'Bez tytułu'}`}
                    title="Kliknij aby wybrać ten produkt do moderacji"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">
                      {product.title?.pl || product.title || 'Bez tytułu'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      ID: {product.id}
                    </p>
                    {product.bestPrice && (
                      <p className="text-sm text-slate-700 mt-1">
                        💰 {formatPrice(product.bestPrice.amount)}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {product.mainCategorySlug || 'uncategorized'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Créé: {new Date(product.createdAt).toLocaleDateString('pl-PL')}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Result */}
            {result && (
              <div
                className={`p-4 rounded-lg border-2 space-y-2 ${
                  result.success
                    ? 'border-green-300 bg-green-50'
                    : 'border-red-300 bg-red-50'
                }`}
              >
                <p className="font-semibold text-slate-900">
                  {result.success ? '✅ Sukces!' : '❌ Błąd'}
                </p>
                <p className="text-sm text-slate-700">
                  {result.message || result.error}
                </p>
                {result.approved && (
                  <p className="text-sm text-slate-600">
                    Zatwierdzono: {result.approved}, Błędy: {result.failed}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ==================== UI COMPONENTS ==================== */

function JobItem({ job }: { job: HarvesterJob }) {
  const [expanded, setExpanded] = useState(false);
  
  const isTreeMode = (job.totalCategories || 0) > 0;
  // Fallback for progress percent
  const progressPercent = isTreeMode
    ? Math.round(((job.processedCategories?.length || 0) / (job.totalCategories || 1)) * 100)
    : (job.progress || 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-blue-100 text-blue-700";
      case "completed": return "bg-green-100 text-green-700";
      case "failed": return "bg-red-100 text-red-700";
      case "paused": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const durationStr = (() => {
     const end = new Date(job.completedAt || new Date()).getTime();
     const start = new Date(job.startedAt).getTime();
     return `${Math.round((end - start) / 1000)}s`;
  })();

  return (
    <div className="p-4 border rounded-lg hover:bg-slate-50 transition-colors bg-white shadow-sm mb-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          {/* Header Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={getStatusColor(job.status)}>
              {job.status === 'running' && <Zap className="w-3 h-3 mr-1 animate-spin" />}
              {job.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {job.status}
            </Badge>
            <span className="font-mono text-sm text-slate-600">
              {job.id.slice(0, 8)}...
            </span>
            <span className="text-sm text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(job.startedAt).toLocaleString("pl-PL")}
            </span>
             {isTreeMode && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                  <ListTree className="w-3 h-3 mr-1" />
                  Tree Mode
                </Badge>
             )}
          </div>

          <div className="text-sm flex items-center">
             <span className="font-semibold text-slate-700 whitespace-nowrap">{job.source}</span>
             <ArrowRight className="mx-1 w-3 h-3 text-slate-400 flex-shrink-0" />
             <span className="font-mono text-slate-600 bg-slate-100 px-1 rounded truncate max-w-[250px]" title={job.query}>
               "{job.query}"
             </span>
          </div>

          {/* Progress Section */}
          <div className="space-y-1.5 p-3 bg-slate-50 rounded-md border border-slate-100">
            {isTreeMode ? (
               <div className="flex justify-between text-xs font-medium text-slate-600">
                 <div className="flex flex-col gap-0.5">
                   <span>Kategorie: {job.processedCategories?.length || 0} / {job.totalCategories}</span>
                   {job.processedCategories && job.processedCategories.length > 0 && (
                     <span className="text-[10px] text-slate-400">
                       Ost: {job.processedCategories[job.processedCategories.length - 1].category} ({job.processedCategories[job.processedCategories.length - 1].count})
                     </span>
                   )}
                 </div>
                 <span>{progressPercent}%</span>
               </div>
            ) : (
                <div className="flex justify-between text-xs font-medium text-slate-600">
                     <span>Postęp ogólny</span>
                    <span>{progressPercent}%</span>
                </div>
            )}
            
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${job.status === 'failed' ? 'bg-red-500' : 'bg-blue-600'}`}
                style={{ width: `${Math.max(2, Math.min(100, progressPercent))}%` }}
              />
            </div>
            
            {/* Detailed Info for Tree Mode */}
            {isTreeMode && job.processedCategories && (
              <div className="pt-1 flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
                {job.processedCategories.slice(-3).map((cat, i) => (
                  <div key={i} className="flex-shrink-0 text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500 whitespace-nowrap">
                    {cat.status === 'ok' ? '✅' : '❌'} {cat.category.split('/').pop()} <span className="font-bold">({cat.count})</span>
                  </div>
                ))}
                {job.processedCategories.length > 3 && (
                  <span className="text-[10px] text-slate-400 self-center">...</span>
                )}
              </div>
            )}

            {job.status === 'running' && isTreeMode && job.currentCategory && (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 p-1.5 rounded border border-blue-100 animate-pulse mt-1">
                  <Zap className="w-3 h-3" />
                  <span className="font-semibold">Przetwarzanie:</span>
                  <span className="font-mono truncate flex-1">{job.currentCategory}</span>
                </div>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <MetricBox label="Znaleziono" value={job.productsFound} />
            <MetricBox label="Produkty (+)" value={job.productsCreated} color="text-green-600" />
            <MetricBox label="Deale (+)" value={job.dealsCreated} color="text-blue-600" />
            <MetricBox label="Czas" value={durationStr} />
          </div>
        </div>

        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="ml-4">
                  Szczegóły
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Szczegóły Zadania: {job.id}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                {/* Header Stats */}
                <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg shrink-0 border">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium">Status</p>
                      <Badge className={cn("mt-1", getStatusColor(job.status))}>{job.status}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium">Source</p>
                      <p className="font-mono font-bold text-slate-700">{job.source}</p>
                    </div>
                     <div>
                      <p className="text-xs text-slate-500 uppercase font-medium">Found</p>
                      <p className="font-bold text-slate-900">{job.productsFound}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-medium">New</p>
                      <span className="font-bold text-green-600">+{job.productsCreated}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="font-bold text-blue-600">Deal +{job.dealsCreated}</span>
                    </div>
                </div>

                 {/* Main Content: Tree View */}
                {job.processedCategories && job.processedCategories.length > 0 ? (
                  <div className="flex-1 border rounded-lg overflow-hidden flex flex-col bg-white">
                     <div className="px-4 py-2 border-b bg-slate-50 flex justify-between items-center">
                        <span className="font-semibold text-slate-700 flex items-center gap-2">
                           <ListTree className="w-4 h-4" />
                           Struktura i Postęp Kategorii
                        </span>
                        <Badge variant="outline" className="bg-white">
                           {job.processedCategories.length} przetworzonych
                        </Badge>
                     </div>
                     <div className="flex-1 overflow-y-auto bg-white">
                        <JobCategoryTree categories={job.processedCategories} />
                     </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center border rounded-lg bg-slate-50 border-dashed">
                     <div className="text-center text-slate-500">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Brak danych o strukturze kategorii dla tego zadania.</p>
                     </div>
                  </div>
                )}
              </div>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color = "text-slate-900" }: { label: string, value: any, color?: string }) {
  return (
    <div className="bg-slate-50 p-2 rounded border border-slate-100 text-center">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
      <p className={`font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DuplicatesOverviewDialog({
  open,
  onOpenChange,
  jobs
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: HarvesterJob[];
}) {
  const jobsWithDuplicates = jobs.filter(j => (j.duplicatesSkipped || 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Przegląd Pominiętych Duplikatów (Ostatnie joby)</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto pr-2">
          {jobsWithDuplicates.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Brak duplikatów w ostatnich zadaniach.
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {jobsWithDuplicates.map((job) => {
                 const duplicateLogs = ((job as any).logs || []).filter((l: any) => 
                    l.message.includes("Found existing product")
                 );

                 return (
                  <AccordionItem key={job.id} value={job.id}>
                    <AccordionTrigger className="hover:no-underline px-1">
                      <div className="flex items-center gap-2 md:gap-4 text-left w-full pr-4">
                        <Badge variant="outline" className="shrink-0">{job.source}</Badge>
                        <span className="font-mono text-sm truncate max-w-[150px] md:max-w-[300px]" title={job.query}>{job.query}</span>
                        <div className="flex-1" />
                        <span className="text-amber-600 font-bold whitespace-nowrap">
                          {job.duplicatesSkipped} match
                        </span>
                        <span className="text-xs text-slate-400 font-normal hidden md:inline">
                          {new Date(job.startedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ScrollArea className="h-60 w-full rounded border bg-slate-50 p-2">
                         {duplicateLogs.length > 0 ? (
                           <div className="space-y-1.5">
                             {duplicateLogs.map((log, idx) => (
                               <div key={idx} className="text-xs font-mono text-slate-700 border-b border-slate-200/50 pb-1 last:border-0 break-all">
                                 <span className="text-slate-400 mr-2 select-none">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                 {log.message}
                               </div>
                             ))}
                           </div>
                         ) : (
                           <p className="text-xs text-slate-400 italic p-2">
                             Brak szczegółowych logów dla duplikatów w pamięci podręcznej joba.
                           </p>
                         )}
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                 );
              })}
            </Accordion>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
