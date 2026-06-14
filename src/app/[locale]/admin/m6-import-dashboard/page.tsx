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
import { AliExpressAutopilotControl } from '@/components/admin/aliexpress-autopilot-control';
import { ScheduleManager } from '@/components/admin/schedule-manager';

function toSafeText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

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
          cache: 'no-store',
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
        cache: 'no-store',
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

  const runBulkTest = async (params: {
    refinementType: 'full_enrichment' | 'specs_cleanup';
    limit?: number;
    status?: string;
  }) => {
    if (!authToken) return alert('Brak tokenu autoryzacji');

    const nextLimit = params.limit ?? 5;
    const nextStatus = params.status ?? 'draft';

    setRefinementType(params.refinementType);
    setLimit(nextLimit);
    setStatus(nextStatus);

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
          status: nextStatus === 'all' ? undefined : nextStatus,
          limit: nextLimit,
          refinementType: params.refinementType,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setJobId(data.jobId);
        alert(`✅ Test refinera uruchomiony!\nJob ID: ${data.jobId}`);
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-slate-900">Szybkie testy (lokalnie)</p>
          <Badge variant="outline" className="text-xs">TEST</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => runBulkTest({ refinementType: 'full_enrichment', limit: 5, status: 'draft' })}
            disabled={running}
          >
            Refiner full (5)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => runBulkTest({ refinementType: 'specs_cleanup', limit: 5, status: 'draft' })}
            disabled={running}
          >
            Refiner specs (5)
          </Button>
        </div>
        <p className="text-xs text-slate-600 mt-2">
          Testy uruchamiają się na statusie "draft" z limitem 5.
        </p>
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
  const getCategoryPathParts = (value: unknown): string[] => {
    if (typeof value !== 'string') return ['unknown'];
    return value
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);
  };

  // 1. Build Tree
  const root: Record<string, CategoryNode> = {};
  
  categories.forEach(cat => {
    const parts = getCategoryPathParts(cat.category);
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
  const [stoppingJobs, setStoppingJobs] = useState<Record<string, boolean>>({});
  const [deletingJobs, setDeletingJobs] = useState<Record<string, boolean>>({});

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
        cache: 'no-store',
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
        cache: 'no-store',
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
        cache: 'no-store',
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

  const stopJob = async (jobId: string) => {
    if (!authToken) return setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
    if (!confirm('Zatrzymać to zadanie?')) return;

    setStoppingJobs(prev => ({ ...prev, [jobId]: true }));
    try {
      const res = await fetch(`/api/admin/harvester-jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Nie udało się zatrzymać zadania');
      }

      await refreshJobs();
      alert('✅ Zadanie zostało zatrzymane');
    } catch (e: any) {
      alert(`❌ Błąd zatrzymywania: ${e?.message || e}`);
    } finally {
      setStoppingJobs(prev => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!authToken) return setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
    if (!confirm('Usunąć to zadanie z historii?')) return;

    setDeletingJobs(prev => ({ ...prev, [jobId]: true }));
    try {
      const res = await fetch(`/api/admin/harvester-jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Nie udało się usunąć zadania');
      }

      await refreshJobs();
      alert('✅ Zadanie usunięte z historii');
    } catch (e: any) {
      alert(`❌ Błąd usuwania: ${e?.message || e}`);
    } finally {
      setDeletingJobs(prev => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
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
            <TabsTrigger value="autopilot" className="gap-2">
              <Play className="w-4 h-4" />
              Autopilot UX
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <Clock className="w-4 h-4" />
              Harmonogramy
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
                      <JobItem
                        key={job.id}
                        job={job}
                        onStop={stopJob}
                        onDelete={deleteJob}
                        isStopping={!!stoppingJobs[job.id]}
                        isDeleting={!!deletingJobs[job.id]}
                      />
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

          {/* TAB: Autopilot UX */}
          <TabsContent value="autopilot">
            <AliExpressAutopilotControl
              authToken={authToken}
              setAuthError={setAuthError}
              onActionDone={refreshJobs}
            />
          </TabsContent>

          {/* TAB: Schedules */}
          <TabsContent value="schedule">
            <ScheduleManager
              onConsoleLog={(message, type) => {
                console.log(`[ScheduleManager] ${type}: ${message}`);
              }}
            />
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
  const [autoIsImporting, setAutoIsImporting] = useState(false);
  const [autoMaxResults, setAutoMaxResults] = useState(10000);
  const [autoAliIsImporting, setAutoAliIsImporting] = useState(false);
  const [autoAliMaxResults, setAutoAliMaxResults] = useState(200);
  const [convertiserMode, setConvertiserMode] = useState<'products' | 'offers'>('offers');
  const [importStrategy, setImportStrategy] = useState<'bestsellers' | 'price_asc'>('bestsellers');
  const [autoProgress, setAutoProgress] = useState<{
    jobId?: string;
    productsFound?: number;
    productsCreated?: number;
    dealsCreated?: number;
    dbProducts?: number;
    dbDeals?: number;
    status?: string;
    error?: string;
  }>({});
  const [autoAliProgress, setAutoAliProgress] = useState<{
    jobId?: string;
    productsFound?: number;
    productsCreated?: number;
    dealsCreated?: number;
    dbProducts?: number;
    dbDeals?: number;
    status?: string;
    error?: string;
  }>({});

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

      if (source === 'aliexpress') {
        payload.importStrategy = importStrategy;
      }

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

  const runHarvesterTest = async (params: {
    source: 'convertiser' | 'aliexpress' | 'amazon' | 'allegro';
    query: string;
    maxResults: number;
    convertiserMode?: 'products' | 'offers';
    importStrategy?: 'bestsellers' | 'price_asc';
  }) => {
    if (!authToken) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      setResult({ error: "Brak tokenu administratora" });
      return;
    }

    setSource(params.source);
    setQuery(params.query);
    setMaxResults(params.maxResults);
    setUseCategoryTree(false);
    if (params.source === 'convertiser' && params.convertiserMode) {
      setConvertiserMode(params.convertiserMode);
    }
    if (params.source === 'aliexpress' && params.importStrategy) {
      setImportStrategy(params.importStrategy);
    }

    setLoading(true);
    setResult(null);
    try {
      const payload: Record<string, any> = {
        source: params.source,
        query: params.query,
        maxResults: params.maxResults,
        mode: 'single',
      };

      if (params.source === 'convertiser' && params.convertiserMode) {
        payload.convertiserMode = params.convertiserMode;
      }
      if (params.source === 'aliexpress') {
        payload.importStrategy = params.importStrategy || importStrategy;
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

  const handleAutoImport = async () => {
    if (!authToken) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      return;
    }

    try {
      setAutoIsImporting(true);
      setAutoProgress({});

      const response = await fetch('/api/admin/harvester/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          source: 'convertiser',
          query: '',
          maxResults: autoMaxResults,
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

      setAutoProgress({ jobId, status: 'running' });

      let pollAttempts = 0;
      const maxPollAttempts = 12; // ~1 min
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/admin/harvester-jobs?jobId=${jobId}`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${authToken}` },
          });

          if (statusResponse.status === 401 || statusResponse.status === 403) {
            clearInterval(pollInterval);
            setAutoProgress(prev => ({
              ...prev,
              status: 'failed',
              error: 'Brak uprawnień (401/403) do odczytu statusu joba.',
            }));
            setAutoIsImporting(false);
            return;
          }

          const statusData = await statusResponse.json();

          if (!statusData.success || !statusData.job) {
            pollAttempts += 1;

            const listResponse = await fetch('/api/admin/harvester-jobs?limit=50', {
              cache: 'no-store',
              headers: { Authorization: `Bearer ${authToken}` },
            });

            if (listResponse.ok) {
              const listData = await listResponse.json();
              const fallbackJob = (listData.jobs || []).find((j: any) => j.id === jobId);
              if (fallbackJob) {
                setAutoProgress({
                  jobId,
                  productsFound: fallbackJob.productsFound || 0,
                  productsCreated: fallbackJob.productsCreated || 0,
                  dealsCreated: fallbackJob.dealsCreated || 0,
                  status: fallbackJob.status,
                });

                if (fallbackJob.status === 'completed' || fallbackJob.status === 'failed') {
                  clearInterval(pollInterval);
                  setAutoIsImporting(false);
                  onJobCreated();
                }
                return;
              }
            }

            if (pollAttempts <= maxPollAttempts) {
              setAutoProgress(prev => ({
                ...prev,
                status: 'running',
                error: 'Czekam na zapis joba w bazie...'
              }));
              return;
            }

            clearInterval(pollInterval);
            setAutoProgress(prev => ({
              ...prev,
              status: 'failed',
              error: statusData.error || 'Nie udało się pobrać statusu joba.'
            }));
            setAutoIsImporting(false);
            return;
          }

          const job = statusData.job;
          setAutoProgress({
            jobId,
            productsFound: job.productsFound || 0,
            productsCreated: job.productsCreated || 0,
            dealsCreated: job.dealsCreated || 0,
            status: job.status,
          });

          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollInterval);
            setAutoIsImporting(false);
            onJobCreated();

            if (job.status === 'completed') {
              try {
                const verifyRes = await fetch(`/api/admin/harvester/verify?jobId=${jobId}`, {
                  cache: 'no-store',
                  headers: { Authorization: `Bearer ${authToken}` },
                });
                if (verifyRes.ok) {
                  const verifyData = await verifyRes.json();
                  setAutoProgress(prev => ({
                    ...prev,
                    dbProducts: verifyData.productsInDb || 0,
                    dbDeals: verifyData.dealsInDb || 0,
                  }));
                }
              } catch (verifyErr) {
                console.error('Verify DB counts failed:', verifyErr);
              }
            }
          }
        } catch (pollError) {
          console.error('Failed to poll job status:', pollError);
          clearInterval(pollInterval);
          setAutoProgress(prev => ({
            ...prev,
            status: 'failed',
            error: 'Błąd sieci podczas odczytu statusu joba.'
          }));
          setAutoIsImporting(false);
        }
      }, 5000);
    } catch (error) {
      console.error('Auto-import error:', error);
      setAutoProgress(prev => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      setAutoIsImporting(false);
    }
  };

  const handleAutoImportAliExpress = async () => {
    if (!authToken) {
      setAuthError("Brak tokenu administratora. Zaloguj się ponownie.");
      return;
    }

    try {
      setAutoAliIsImporting(true);
      setAutoAliProgress({});

      const response = await fetch('/api/admin/harvester/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          source: 'aliexpress',
          query: '',
          maxResults: autoAliMaxResults,
          autoBrowse: true,
          importStrategy,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to start AliExpress auto-import');
      }

      const jobId = data.job?.id;
      if (!jobId) {
        throw new Error('No job ID returned');
      }

      setAutoAliProgress({ jobId, status: 'running' });

      let pollAttempts = 0;
      const maxPollAttempts = 12; // ~1 min
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/admin/harvester-jobs?jobId=${jobId}`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${authToken}` },
          });

          if (statusResponse.status === 401 || statusResponse.status === 403) {
            clearInterval(pollInterval);
            setAutoAliProgress(prev => ({
              ...prev,
              status: 'failed',
              error: 'Brak uprawnień (401/403) do odczytu statusu joba.',
            }));
            setAutoAliIsImporting(false);
            return;
          }

          const statusData = await statusResponse.json();

          if (!statusData.success || !statusData.job) {
            pollAttempts += 1;

            const listResponse = await fetch('/api/admin/harvester-jobs?limit=50', {
              cache: 'no-store',
              headers: { Authorization: `Bearer ${authToken}` },
            });

            if (listResponse.ok) {
              const listData = await listResponse.json();
              const fallbackJob = (listData.jobs || []).find((j: any) => j.id === jobId);
              if (fallbackJob) {
                setAutoAliProgress({
                  jobId,
                  productsFound: fallbackJob.productsFound || 0,
                  productsCreated: fallbackJob.productsCreated || 0,
                  dealsCreated: fallbackJob.dealsCreated || 0,
                  status: fallbackJob.status,
                });

                if (fallbackJob.status === 'completed' || fallbackJob.status === 'failed') {
                  clearInterval(pollInterval);
                  setAutoAliIsImporting(false);
                  onJobCreated();
                }
                return;
              }
            }

            if (pollAttempts <= maxPollAttempts) {
              setAutoAliProgress(prev => ({
                ...prev,
                status: 'running',
                error: 'Czekam na zapis joba w bazie...'
              }));
              return;
            }

            clearInterval(pollInterval);
            setAutoAliProgress(prev => ({
              ...prev,
              status: 'failed',
              error: statusData.error || 'Nie udało się pobrać statusu joba.'
            }));
            setAutoAliIsImporting(false);
            return;
          }

          const job = statusData.job;
          setAutoAliProgress({
            jobId,
            productsFound: job.productsFound || 0,
            productsCreated: job.productsCreated || 0,
            dealsCreated: job.dealsCreated || 0,
            status: job.status,
          });

          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollInterval);
            setAutoAliIsImporting(false);
            onJobCreated();

            if (job.status === 'completed') {
              try {
                const verifyRes = await fetch(`/api/admin/harvester/verify?jobId=${jobId}`, {
                  cache: 'no-store',
                  headers: { Authorization: `Bearer ${authToken}` },
                });
                if (verifyRes.ok) {
                  const verifyData = await verifyRes.json();
                  setAutoAliProgress(prev => ({
                    ...prev,
                    dbProducts: verifyData.productsInDb || 0,
                    dbDeals: verifyData.dealsInDb || 0,
                  }));
                }
              } catch (verifyErr) {
                console.error('Verify DB counts failed:', verifyErr);
              }
            }
          }
        } catch (pollError) {
          console.error('Failed to poll AliExpress job status:', pollError);
          clearInterval(pollInterval);
          setAutoAliProgress(prev => ({
            ...prev,
            status: 'failed',
            error: 'Błąd sieci podczas odczytu statusu joba.'
          }));
          setAutoAliIsImporting(false);
        }
      }, 5000);
    } catch (error) {
      console.error('AliExpress auto-import error:', error);
      setAutoAliProgress(prev => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      setAutoAliIsImporting(false);
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

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Szybkie testy (lokalnie)</p>
              <p className="text-xs text-slate-600">Małe batchy do weryfikacji jakości importu</p>
            </div>
            <Badge variant="outline" className="text-xs">TEST</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => runHarvesterTest({
                source: 'convertiser',
                query: 'laptop',
                maxResults: 10,
                convertiserMode: 'offers',
              })}
              disabled={loading}
              className="gap-2"
            >
              Convertiser offers (10)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => runHarvesterTest({
                source: 'convertiser',
                query: 'smartwatch',
                maxResults: 10,
                convertiserMode: 'products',
              })}
              disabled={loading}
              className="gap-2"
            >
              Convertiser products (10)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => runHarvesterTest({
                source: 'aliexpress',
                query: 'usb c charger',
                maxResults: 10,
                importStrategy: 'bestsellers',
              })}
              disabled={loading}
              className="gap-2"
            >
              AliExpress (10)
            </Button>
          </div>
        </div>

        {source === 'convertiser' && (
          <div className="space-y-4 rounded-lg border-2 border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <Download className="text-white" size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Auto Import Convertiser (bez słów kluczowych)</p>
                  <p className="text-xs text-slate-600">Pobiera cały katalog Convertiser z paginacją</p>
                </div>
              </div>
              <Badge className="bg-purple-600">AUTO</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="auto-max-results">Max Results</Label>
                <Input
                  id="auto-max-results"
                  type="number"
                  value={autoMaxResults}
                  onChange={(e) => setAutoMaxResults(parseInt(e.target.value) || 10000)}
                  min={1000}
                  max={50000}
                  step={1000}
                  disabled={autoIsImporting}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">Maksymalna liczba produktów (1000-50000)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-mode">Mode</Label>
                <Select value={convertiserMode} onValueChange={(v) => setConvertiserMode(v as 'products' | 'offers')} disabled={autoIsImporting}>
                  <SelectTrigger id="auto-mode">
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

            {autoProgress.status && (
              <div className="rounded-lg border border-purple-200 bg-white p-3">
                <div className="flex items-center gap-2 mb-2">
                  {autoProgress.status === 'running' && (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full" />
                      <span className="text-sm font-semibold text-slate-900">⏳ Import w toku...</span>
                    </>
                  )}
                  {autoProgress.status === 'completed' && (
                    <>
                      <CheckCircle2 className="text-green-600" size={18} />
                      <span className="text-sm font-semibold text-green-900">✅ Import zakończony!</span>
                    </>
                  )}
                  {autoProgress.status === 'failed' && (
                    <>
                      <AlertCircle className="text-red-600" size={18} />
                      <span className="text-sm font-semibold text-red-900">❌ Import nie powiódł się</span>
                    </>
                  )}
                </div>

                {autoProgress.jobId && (
                  <p className="text-xs text-gray-500 mb-2">Job ID: {autoProgress.jobId}</p>
                )}

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-blue-50 rounded p-2">
                    <div className="text-blue-600 font-medium">Znaleziono</div>
                    <div className="text-lg font-bold text-blue-900">{autoProgress.productsFound || 0}</div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="text-green-600 font-medium">Produkty</div>
                    <div className="text-lg font-bold text-green-900">{autoProgress.productsCreated || 0}</div>
                  </div>
                  <div className="bg-purple-50 rounded p-2">
                    <div className="text-purple-600 font-medium">Oferty</div>
                    <div className="text-lg font-bold text-purple-900">{autoProgress.dealsCreated || 0}</div>
                  </div>
                </div>

                {(autoProgress.dbProducts !== undefined || autoProgress.dbDeals !== undefined) && (
                  <div className="mt-2 text-xs text-slate-600">
                    Zapisane w bazie: produkty {autoProgress.dbProducts ?? 0}, oferty {autoProgress.dbDeals ?? 0}
                  </div>
                )}

                {autoProgress.error && (
                  <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {autoProgress.error}
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleAutoImport}
              disabled={autoIsImporting}
              className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              {autoIsImporting ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Importowanie...
                </>
              ) : (
                <>
                  <Download size={18} />
                  Uruchom Auto Import
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Query input */}
        {source === 'aliexpress' && (
          <div className="space-y-4">
            <div className="space-y-2 border border-slate-200 rounded-lg p-4 bg-slate-50">
              <Label htmlFor="import-strategy" className="text-sm font-semibold text-slate-900">
                Strategia importu AliExpress
              </Label>
              <Select value={importStrategy} onValueChange={(v) => setImportStrategy(v as 'bestsellers' | 'price_asc')}>
                <SelectTrigger id="import-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bestsellers">Bestsellery (najpierw największa sprzedaż)</SelectItem>
                  <SelectItem value="price_asc">Najniższa cena (rosnąco)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Działa dla AliExpress. W trybie drzewka domyślnie zalecane: Bestsellery.
              </p>
            </div>

            <div className="space-y-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                    <Download className="text-white" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Auto Import AliExpress (bez iteracji query)</p>
                    <p className="text-xs text-slate-600">Pobiera hot katalog i mapuje do kategorii po imporcie</p>
                  </div>
                </div>
                <Badge className="bg-blue-600">AUTO</Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-ali-max-results">Max Results</Label>
                <Input
                  id="auto-ali-max-results"
                  type="number"
                  value={autoAliMaxResults}
                  onChange={(e) => setAutoAliMaxResults(parseInt(e.target.value) || 200)}
                  min={20}
                  max={200}
                  step={10}
                  disabled={autoAliIsImporting}
                  className="w-full"
                />
                <p className="text-xs text-slate-500">Maksymalna liczba produktów (20-200)</p>
              </div>

              {autoAliProgress.status && (
                <div className="rounded-lg border border-blue-200 bg-white p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {autoAliProgress.status === 'running' && (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                        <span className="text-sm font-semibold text-slate-900">⏳ Import w toku...</span>
                      </>
                    )}
                    {autoAliProgress.status === 'completed' && (
                      <>
                        <CheckCircle2 className="text-green-600" size={18} />
                        <span className="text-sm font-semibold text-green-900">✅ Import zakończony!</span>
                      </>
                    )}
                    {autoAliProgress.status === 'failed' && (
                      <>
                        <AlertCircle className="text-red-600" size={18} />
                        <span className="text-sm font-semibold text-red-900">❌ Import nie powiódł się</span>
                      </>
                    )}
                  </div>

                  {autoAliProgress.jobId && (
                    <p className="text-xs text-gray-500 mb-2">Job ID: {autoAliProgress.jobId}</p>
                  )}

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-blue-600 font-medium">Znaleziono</div>
                      <div className="text-lg font-bold text-blue-900">{autoAliProgress.productsFound || 0}</div>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <div className="text-green-600 font-medium">Produkty</div>
                      <div className="text-lg font-bold text-green-900">{autoAliProgress.productsCreated || 0}</div>
                    </div>
                    <div className="bg-purple-50 rounded p-2">
                      <div className="text-purple-600 font-medium">Oferty</div>
                      <div className="text-lg font-bold text-purple-900">{autoAliProgress.dealsCreated || 0}</div>
                    </div>
                  </div>

                  {(autoAliProgress.dbProducts !== undefined || autoAliProgress.dbDeals !== undefined) && (
                    <div className="mt-2 text-xs text-slate-600">
                      Zapisane w bazie: produkty {autoAliProgress.dbProducts ?? 0}, oferty {autoAliProgress.dbDeals ?? 0}
                    </div>
                  )}

                  {autoAliProgress.error && (
                    <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      {autoAliProgress.error}
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleAutoImportAliExpress}
                disabled={autoAliIsImporting}
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {autoAliIsImporting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Importowanie...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Uruchom Auto Import AliExpress
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

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

        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-purple-600" />
            <p className="text-sm font-semibold text-slate-900">Bulk AI Refiner</p>
            <span className="text-xs text-slate-500">(masowe wzbogacanie)</span>
          </div>
          <BulkRefinerPanel authToken={authToken} />
        </div>
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

  const getProductTitle = (title: any): string => {
    if (!title) return 'Bez tytułu';
    if (typeof title === 'string') return title;
    if (typeof title === 'object') {
      return title.pl || title.en || title.de || 'Bez tytułu';
    }
    return 'Bez tytułu';
  };

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
                    aria-label={`Wybierz produkt: ${getProductTitle(product.title)}`}
                    title="Kliknij aby wybrać ten produkt do moderacji"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">
                      {getProductTitle(product.title)}
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

function JobItem({
  job,
  onStop,
  onDelete,
  isStopping,
  isDeleting,
}: {
  job: HarvesterJob;
  onStop: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  isStopping?: boolean;
  isDeleting?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const queryLabel = toSafeText((job as any).query, "[nieprawidlowe zapytanie]");
  const sourceLabel = toSafeText((job as any).source, "unknown");
  
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
             <span className="font-semibold text-slate-700 whitespace-nowrap">{sourceLabel}</span>
             <ArrowRight className="mx-1 w-3 h-3 text-slate-400 flex-shrink-0" />
             <span className="font-mono text-slate-600 bg-slate-100 px-1 rounded truncate max-w-[250px]" title={queryLabel}>
               "{queryLabel}"
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
                    {cat.status === 'ok' ? '✅' : '❌'} {(typeof cat.category === 'string' ? cat.category.split('/').pop() : 'unknown')} <span className="font-bold">({cat.count})</span>
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

        <div className="ml-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStop(job.id)}
            disabled={job.status !== 'running' || isStopping}
            className="gap-2"
            title={job.status !== 'running' ? 'Zatrzymaj tylko aktywne zadania' : 'Zatrzymaj zadanie'}
          >
            {isStopping ? (
              <div className="animate-spin w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
            Zatrzymaj
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(job.id)}
            disabled={isDeleting}
            className="gap-2 text-slate-600 hover:text-red-600"
            title="Usuń zadanie z historii"
          >
            {isDeleting ? (
              <div className="animate-spin w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Usuń
          </Button>
          <Dialog>
              <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
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
                        <p className="font-mono font-bold text-slate-700">{sourceLabel}</p>
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

                 const queryLabel = toSafeText((job as any).query, "[nieprawidlowe zapytanie]");
                 const sourceLabel = toSafeText((job as any).source, "unknown");

                 return (
                  <AccordionItem key={job.id} value={job.id}>
                    <AccordionTrigger className="hover:no-underline px-1">
                      <div className="flex items-center gap-2 md:gap-4 text-left w-full pr-4">
                        <Badge variant="outline" className="shrink-0">{sourceLabel}</Badge>
                        <span className="font-mono text-sm truncate max-w-[150px] md:max-w-[300px]" title={queryLabel}>{queryLabel}</span>
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
