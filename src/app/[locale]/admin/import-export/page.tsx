"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Zap, Copy, Trash2, Activity, Settings } from "lucide-react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { JobsMonitor } from "@/components/admin/jobs-monitor";
import { JobQueueManager } from "@/components/admin/job-queue-manager";

type DataType = "okazje" | "produkty";
type StatusFilter = "gotowe" | "drafty" | "wszystko";

interface ImportSession {
  id: string;
  type: DataType;
  status: StatusFilter;
  startTime: Date;
  result?: any;
  logs: string[];
}

export default function ImportExportPage() {
  const [importType, setImportType] = useState<DataType>("okazje");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("gotowe");
  const [jsonInput, setJsonInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Config produkty
  const [batchSize, setBatchSize] = useState(500);
  const [upsert, setUpsert] = useState(true);
  const [dedupe, setDedupe] = useState(true);
  const [enrichData, setEnrichData] = useState(false);
  const [translateData, setTranslateData] = useState(false);

  // Config okazje
  const [autoApprove, setAutoApprove] = useState(false);

  const getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    return await user.getIdToken();
  };

  const addLog = (sessionId: string, message: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, logs: [...s.logs, `[${new Date().toLocaleTimeString()}] ${message}`] } : s
      )
    );
  };

  const createSession = () => {
    const session: ImportSession = {
      id: `session-${Date.now()}`,
      type: importType,
      status: statusFilter,
      startTime: new Date(),
      logs: [`Sesja rozpoczęta dla: ${importType} (${statusFilter})`],
    };
    setSessions((prev) => [session, ...prev]);
    return session;
  };

  const runDryRun = async () => {
    if (!jsonInput.trim()) {
      toast.error("Wklej JSON do importu");
      return;
    }

    const session = createSession();
    setIsProcessing(true);
    setResult(null);

    try {
      const token = await getAuthToken();
      let payload: any;

      if (importType === "produkty") {
        let parsed = JSON.parse(jsonInput || "[]");
        parsed = Array.isArray(parsed) ? parsed : [];
        payload = { products: parsed, upsert, dedupe, batchSize, dryRun: true, status: statusFilter };

        addLog(session.id, `DRY-RUN: Analiza ${parsed.length} produktów`);

        const res = await fetch("/api/admin-import/products", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: "dry-run", payload }),
        });
        const data = await res.json();
        addLog(session.id, `✓ Analiza zakończona: ${data.summary?.total || 0} produktów`);
        setResult(data);
      } else {
        let parsed = JSON.parse(jsonInput || "[]");
        parsed = Array.isArray(parsed) ? parsed : [];
        payload = { deals: parsed, autoApprove, batchSize, dryRun: true, status: statusFilter };

        addLog(session.id, `DRY-RUN: Analiza ${parsed.length} okazji`);

        const res = await fetch("/api/admin-import/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: "dry-run", payload }),
        });
        const data = await res.json();
        addLog(session.id, `✓ Analiza zakończona: ${data.summary?.total || 0} okazji`);
        setResult(data);
      }
    } catch (e: any) {
      addLog(session.id, `❌ Błąd: ${e?.message}`);
      setResult({ ok: false, error: e?.message });
      toast.error("Błąd dry-run");
    } finally {
      setIsProcessing(false);
    }
  };

  const runImport = async () => {
    if (!result?.ok) {
      toast.error("Uruchom najpierw Dry-run");
      return;
    }

    const session = createSession();
    setIsProcessing(true);

    try {
      const token = await getAuthToken();
      let payload: any;

      if (importType === "produkty") {
        let parsed = JSON.parse(jsonInput || "[]");
        parsed = Array.isArray(parsed) ? parsed : [];
        payload = { products: parsed, upsert, dedupe, batchSize, dryRun: false, status: statusFilter, enrichData, translateData };

        addLog(session.id, `IMPORT: Importowanie ${parsed.length} produktów...`);

        const res = await fetch("/api/admin-import/products", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: "run", payload }),
        });
        const data = await res.json();

        if (data.ok) {
          addLog(session.id, `✅ Sukces! Utworzono: ${data.result?.created || 0}, Zaktualizowano: ${data.result?.updated || 0}`);
          toast.success(`Import OK: ${data.result?.created} nowych, ${data.result?.updated} zaktualizowanych`);
        } else {
          addLog(session.id, `❌ Import nie powiódł się`);
          toast.error("Import nie powiódł się");
        }

        setResult(data);
      } else {
        let parsed = JSON.parse(jsonInput || "[]");
        parsed = Array.isArray(parsed) ? parsed : [];
        payload = { deals: parsed, autoApprove, batchSize, dryRun: false, status: statusFilter, translateData };

        addLog(session.id, `IMPORT: Importowanie ${parsed.length} okazji...`);

        const res = await fetch("/api/admin-import/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: "run", payload }),
        });
        const data = await res.json();

        if (data.ok) {
          addLog(session.id, `✅ Sukces! Utworzono: ${data.result?.created || 0}, Zaktualizowano: ${data.result?.updated || 0}`);
          toast.success(`Import OK: ${data.result?.created} nowych, ${data.result?.updated} zaktualizowanych`);
        } else {
          addLog(session.id, `❌ Import nie powiódł się`);
          toast.error("Import nie powiódł się");
        }

        setResult(data);
      }
    } catch (e: any) {
      addLog(session.id, `❌ Błąd: ${e?.message}`);
      setResult({ ok: false, error: e?.message });
      toast.error("Błąd importu");
    } finally {
      setIsProcessing(false);
    }
  };

  const killAllSessions = () => {
    setSessions([]);
    setResult(null);
    toast.success("Historia sesji wyczyszczona");
  };

  const copySampleJSON = () => {
    const sample = importType === "produkty"
      ? JSON.stringify([{name:"Produkt",description:"Opis",price:99.99,affiliateUrl:"https://example.com",mainCategorySlug:"elektronika",subCategorySlug:"smartfony"}], null, 2)
      : JSON.stringify([{title:"Okazja",description:"Opis",price:49.99,link:"https://example.com",mainCategorySlug:"elektronika",subCategorySlug:"akcesoria"}], null, 2);
    navigator.clipboard.writeText(sample);
    toast.success("Skopiowano!");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="font-headline text-3xl font-bold">📊 Import & Export Console</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
            📋 Historia ({sessions.length})
          </Button>
          {sessions.length > 0 && (
            <Button variant="destructive" size="sm" onClick={killAllSessions}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="import" className="gap-2">
            <Copy className="h-4 w-4" />
            Import JSON
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-2">
            <Activity className="h-4 w-4" />
            Job Monitor
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2">
            <Settings className="h-4 w-4" />
            Job Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6 mt-6">

      {/* OPCJE */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle>1️⃣ Wybierz opcje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">📦 Typ</label>
              <div className="flex gap-2">
                <Button variant={importType === "okazje" ? "default" : "outline"} onClick={() => setImportType("okazje")} className="flex-1">
                  🔥 Okazje
                </Button>
                <Button variant={importType === "produkty" ? "default" : "outline"} onClick={() => setImportType("produkty")} className="flex-1">
                  📱 Produkty
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">✅ Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className="w-full border rounded px-3 py-2">
                <option value="gotowe">✓ Gotowe</option>
                <option value="drafty">📝 Drafty</option>
                <option value="wszystko">📋 Wszystko</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">🔧 Przetwarzanie</label>
              {importType === "produkty" && (
                <div className="flex gap-2">
                  <label className="flex items-center gap-1 cursor-pointer"><Checkbox checked={enrichData} onCheckedChange={(v) => setEnrichData(!!v)} /> Enrich</label>
                  <label className="flex items-center gap-1 cursor-pointer"><Checkbox checked={translateData} onCheckedChange={(v) => setTranslateData(!!v)} /> Tłumacz</label>
                </div>
              )}
              {importType === "okazje" && (
                <label className="flex items-center gap-1 cursor-pointer"><Checkbox checked={translateData} onCheckedChange={(v) => setTranslateData(!!v)} /> Tłumacz</label>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KONFIGURACJA */}
      <Card>
        <CardHeader>
          <CardTitle>2️⃣ Parametry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm">Batch size</label>
              <Input type="number" value={batchSize} onChange={(e) => setBatchSize(parseInt(e.target.value || "500"))} />
            </div>
            {importType === "produkty" && (
              <>
                <label className="flex items-center gap-2"><Checkbox checked={upsert} onCheckedChange={(v) => setUpsert(!!v)} /> Upsert</label>
                <label className="flex items-center gap-2"><Checkbox checked={dedupe} onCheckedChange={(v) => setDedupe(!!v)} /> Dedupe</label>
              </>
            )}
            {importType === "okazje" && (
              <label className="flex items-center gap-2"><Checkbox checked={autoApprove} onCheckedChange={(v) => setAutoApprove(!!v)} /> Auto-approve</label>
            )}
          </div>
        </CardContent>
      </Card>

      {/* JSON */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>3️⃣ JSON</CardTitle>
          <Button size="sm" variant="outline" onClick={copySampleJSON}><Copy className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          <Textarea placeholder="Wklej JSON..." value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} className="h-40 font-mono text-xs" />
        </CardContent>
      </Card>

      {/* AKCJE */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50">
        <CardHeader>
          <CardTitle>4️⃣ Uruchom</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={runDryRun} disabled={isProcessing || !jsonInput.trim()} variant="outline">
              🔍 Dry-Run
            </Button>
            <Button onClick={runImport} disabled={isProcessing || !result?.ok} className="bg-green-600 hover:bg-green-700">
              <Zap className="h-4 w-4" /> Import
            </Button>
          </div>

          {result && (
            <div className={`p-4 rounded border ${result.ok ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
              <h4 className="font-semibold mb-2">{result.ok ? "✅ Wynik" : "❌ Błąd"}</h4>
              {result.summary && (
                <div className="space-y-1 text-sm">
                  {result.summary.total && <div>📦 Razem: <strong>{result.summary.total}</strong></div>}
                  {result.summary.toCreate && <div>➕ Do utworzenia: <strong>{result.summary.toCreate}</strong></div>}
                  {result.summary.toUpdate && <div>🔄 Do aktualizacji: <strong>{result.summary.toUpdate}</strong></div>}
                </div>
              )}
              {result.result && (
                <div className="space-y-1 text-sm">
                  <div>✅ Utworzono: <strong>{result.result.created || 0}</strong></div>
                  <div>🔄 Zaktualizowano: <strong>{result.result.updated || 0}</strong></div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* HISTORIA */}
      {showHistory && sessions.length > 0 && (
        <Card className="border-blue-300 bg-blue-50">
          <CardHeader>
            <CardTitle>📋 Historia ({sessions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto">
            {sessions.map((s) => (
              <div key={s.id} className="p-2 bg-white rounded border text-xs">
                <Badge>{s.type === "okazje" ? "🔥" : "📱"} {s.type}</Badge>
                <div className="font-mono text-muted-foreground space-y-0.5 mt-1">
                  {s.logs.slice(-5).map((log, i) => <div key={i}>{log}</div>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Monitor Jobów Importu
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Podgląd i zarządzanie aktywnymi zadaniami importu z różnych źródeł
              </p>
            </CardHeader>
            <CardContent>
              <JobsMonitor />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Kolejka Zadań
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Twórz i zarządzaj zadaniami importu w kolejce
              </p>
            </CardHeader>
            <CardContent>
              <JobQueueManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
