"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth, isAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Play, RefreshCw } from "lucide-react";

interface ImportRun {
  id: string;
  profileId: string;
  vendorId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  dryRun: boolean;
  stats: {
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    duplicates?: number;
  };
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  triggeredBy: "scheduled" | "manual";
  triggeredByUid?: string;
  errorSummary?: Array<{ code: string; message: string; itemId?: string; timestamp?: string }>;
}

async function fetchWithToken<T>(url: string, options?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const headers = {
    ...(options?.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as HeadersInit;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || detail.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function ImportsPage() {
  const { user, loading } = useAuth();
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ImportRun | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingRunDetail, setLoadingRunDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState("");
  const [maxItems, setMaxItems] = useState<string>("");
  const [dryRun, setDryRun] = useState(true);
  const [starting, setStarting] = useState(false);

  const isUserAdmin = useMemo(() => isAdmin(user), [user]);

  useEffect(() => {
    if (!isUserAdmin) return;
    loadRuns();
  }, [isUserAdmin]);

  const loadRuns = async () => {
    try {
      setLoadingRuns(true);
      setError(null);
      const data = await fetchWithToken<{ runs: ImportRun[]; nextCursor?: string }>(
        "/api/admin/import-runs?limit=20"
      );
      setRuns(data.runs);
      if (data.runs.length) {
        setSelectedRun(data.runs[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się pobrać listy importów");
    } finally {
      setLoadingRuns(false);
    }
  };

  const loadRunDetail = async (id: string) => {
    try {
      setLoadingRunDetail(true);
      setError(null);
      const data = await fetchWithToken<ImportRun>(`/api/admin/import-runs/${id}`);
      setSelectedRun(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się pobrać szczegółów importu");
    } finally {
      setLoadingRunDetail(false);
    }
  };

  const startImport = async () => {
    if (!profileId) {
      setError("Podaj profileId importu");
      return;
    }
    try {
      setStarting(true);
      setError(null);
      const payload: any = { profileId, dryRun };
      if (maxItems) payload.maxItems = Number(maxItems);

      const data = await fetchWithToken<{ importRunId?: string; stats?: any }>(
        "/api/admin/products/ingest",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (data.importRunId) {
        await loadRuns();
        await loadRunDetail(data.importRunId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się uruchomić importu");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Ładowanie…</p>
      </div>
    );
  }

  if (!isUserAdmin) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>Potrzebne uprawnienia administratora.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importy produktów</h1>
        <p className="text-gray-500 mt-1">Start, monitorowanie i historia importów (AliExpress / Allegro)</p>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Uruchom import</CardTitle>
            <CardDescription>Podaj ID profilu importu. Włącz dry-run, aby przetestować bez zapisu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Profile ID</Label>
              <Input value={profileId} onChange={(e) => setProfileId(e.target.value)} placeholder="np. abc123" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Maks. produktów (opcjonalnie)</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxItems}
                  onChange={(e) => setMaxItems(e.target.value)}
                  placeholder="np. 20"
                />
              </div>
              <div className="space-y-2">
                <Label>Tryb</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={dryRun ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDryRun(true)}
                  >
                    Dry-run
                  </Button>
                  <Button
                    type="button"
                    variant={!dryRun ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDryRun(false)}
                  >
                    Real
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={startImport} disabled={starting}>
                {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Start importu
              </Button>
              <Button variant="outline" onClick={loadRuns} disabled={loadingRuns}>
                <RefreshCw className="h-4 w-4 mr-2" /> Odśwież listę
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lista importów</CardTitle>
            <CardDescription>Ostatnie uruchomienia (limit 20)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRuns && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie importów…
              </div>
            )}
            {!loadingRuns && runs.length === 0 && <p className="text-sm text-gray-500">Brak importów.</p>}
            <div className="space-y-2 max-h-80 overflow-auto pr-1">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => loadRunDetail(run.id)}
                  className={`w-full text-left border rounded-md px-3 py-2 hover:border-primary transition ${
                    selectedRun?.id === run.id ? "border-primary bg-primary/5" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{run.vendorId} · {run.profileId}</div>
                    <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "outline"}>
                      {run.status}{run.dryRun ? " · dry-run" : ""}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex gap-3">
                    <span>Fetched: {run.stats?.fetched ?? 0}</span>
                    <span>Created: {run.stats?.created ?? 0}</span>
                    <span>Errors: {run.stats?.errors ?? 0}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {run.startedAt}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedRun && (
        <Card>
          <CardHeader>
            <CardTitle>Szczegóły importu</CardTitle>
            <CardDescription>Run ID: {selectedRun.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRunDetail && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie szczegółów…
              </div>
            )}
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="space-y-1">
                <p className="font-semibold">Profil / Vendor</p>
                <p className="text-gray-600">{selectedRun.profileId} · {selectedRun.vendorId}</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Status</p>
                <p className="text-gray-600">
                  {selectedRun.status}{selectedRun.dryRun ? " · dry-run" : ""}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Czas</p>
                <p className="text-gray-600">
                  {selectedRun.startedAt}
                  {selectedRun.finishedAt ? ` → ${selectedRun.finishedAt}` : ""}
                  {selectedRun.durationMs ? ` (${Math.round(selectedRun.durationMs / 1000)}s)` : ""}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <Stat label="Fetched" value={selectedRun.stats?.fetched} />
              <Stat label="Created" value={selectedRun.stats?.created} />
              <Stat label="Updated" value={selectedRun.stats?.updated} />
              <Stat label="Skipped" value={selectedRun.stats?.skipped} />
              <Stat label="Errors" value={selectedRun.stats?.errors} />
              <Stat label="Duplicates" value={selectedRun.stats?.duplicates ?? 0} />
            </div>

            {selectedRun.errorSummary && selectedRun.errorSummary.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold">Błędy</p>
                <div className="space-y-1 text-sm text-gray-700">
                  {selectedRun.errorSummary.map((err, idx) => (
                    <div key={`${err.code}-${idx}`} className="border rounded-md px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{err.code}</span>
                        {err.itemId && <Badge variant="outline">Item: {err.itemId}</Badge>}
                      </div>
                      <p className="text-gray-600 text-sm mt-1">{err.message}</p>
                      {err.timestamp && <p className="text-xs text-gray-400 mt-1">{err.timestamp}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value ?? 0}</p>
    </div>
  );
}
