"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";

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
  const [jobs, setJobs] = useState<HarvesterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<HarvesterJob | null>(null);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const res = await fetch("/api/admin/harvester-jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      console.error("Error loading jobs", err);
    } finally {
      setLoading(false);
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
                    onClick={loadJobs}
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
            <HarvesterWizard onJobCreated={loadJobs} />
          </TabsContent>

          {/* TAB: AI Refiner */}
          <TabsContent value="refiner">
            <RefinerPanel onJobCreated={loadJobs} />
          </TabsContent>

          {/* TAB: Live Monitor */}
          <TabsContent value="monitor">
            <LiveMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ==================== HARVESTER WIZARD ==================== */
function HarvesterWizard({
  onJobCreated,
}: {
  onJobCreated: () => void;
}) {
  const [source, setSource] = useState<"aliexpress" | "amazon" | "allegro">(
    "aliexpress"
  );
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRun = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/harvester/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, query, maxResults }),
      });
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
            placeholder='np. "USB-C Cable 2m" lub "Gaming Laptop"'
            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyPress={(e) => e.key === "Enter" && handleRun()}
          />
          <p className="text-xs text-slate-500">
            Zostanie przesłany do API i automatycznie zdeduplicirowany
          </p>
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
          disabled={!query.trim() || loading}
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
function RefinerPanel({ onJobCreated }: { onJobCreated: () => void }) {
  const [productIds, setProductIds] = useState("");
  const [refinationType, setRefinationType] = useState<"full_enrichment" | "specs_cleanup">(
    "full_enrichment"
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRun = async () => {
    if (!productIds.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const ids = productIds
        .split("\n")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      const res = await fetch("/api/admin/refiner/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: ids, refinationType }),
      });
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
              placeholder="prod_123456&#10;prod_789012&#10;prod_345678"
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
function LiveMonitor() {
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
    setRunning(true);
    setOutput([]);
    try {
      const res = await fetch("/api/admin/execute-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
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
