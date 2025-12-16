"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useAuth, isAdmin } from "@/lib/auth";
import { useTranslations, useFormatter } from "next-intl";
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
  type: 'products' | 'deals';
  source: 'aliexpress' | 'convertiser' | 'manual';
  importerType?: 'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct';
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  stats: {
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    duplicates?: number;
  };
  createdAt: string;
  startedAt?: string;
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
  const t = useTranslations("adminImports");
  const format = useFormatter();
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ImportRun | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingRunDetail, setLoadingRunDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxItems, setMaxItems] = useState<string>("20");
  const [dryRun, setDryRun] = useState(true);
  const [starting, setStarting] = useState(false);
  const [importerType, setImporterType] = useState<'keyword-search' | 'hot-products' | 'convertiser' | 'category-direct'>('keyword-search');
  const [debugKeywords, setDebugKeywords] = useState<string>('smartphone');
  const [debugCategory, setDebugCategory] = useState<string>('electronics');
  const [debugSubcategory, setDebugSubcategory] = useState<string>('phones');
  const [debugSubsubcategory, setDebugSubsubcategory] = useState<string>('smartphones');
  const [debugStage, setDebugStage] = useState<'fetch' | 'dedupe' | 'enrich' | 'translate' | 'save' | 'all'>('fetch');
  const [debugMaxProducts, setDebugMaxProducts] = useState<string>('10');
  const [debugSampleSize, setDebugSampleSize] = useState<string>('3');
  const [debugWriteToDb, setDebugWriteToDb] = useState<boolean>(false);
  const [debugTranslate, setDebugTranslate] = useState<boolean>(true);
  const [debugRunning, setDebugRunning] = useState<boolean>(false);
  const [debugResult, setDebugResult] = useState<any | null>(null);
  const [debugHistory, setDebugHistory] = useState<Array<{ id: string; payload: any; response: any; at: string }>>([]);

  const isUserAdmin = useMemo(() => isAdmin(user), [user]);

  const formatDateTime = (value?: string) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : t("details.noData");

  const formatDuration = (ms?: number) =>
    ms ? `${Math.round(ms / 1000)}s` : "";

  const formatNumber = (value?: number) => format.number(value ?? 0);

  const statusLabel = (status: ImportRun["status"]) => t(`statusMap.${status}` as any);

  const parseKeywords = (value: string) =>
    value
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

  const runDebug = async () => {
    try {
      setDebugRunning(true);
      setError(null);
      const keywords = parseKeywords(debugKeywords);
      if (!keywords.length) {
        throw new Error('Podaj co najmniej jedno keyword');
      }

      const payload: any = {
        keywords,
        categorySlugEN: debugCategory,
        subcategorySlugEN: debugSubcategory,
        subsubcategorySlugEN: debugSubsubcategory || undefined,
        importerType,
        stage: debugStage,
        maxProducts: debugMaxProducts ? Number(debugMaxProducts) : undefined,
        translateToPolish: debugTranslate,
        writeToDb: debugWriteToDb,
        sampleSize: debugSampleSize ? Number(debugSampleSize) : 3,
      };

      const res = await fetchWithToken<any>(
        '/api/admin/import/debug',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const entry = {
        id: `${Date.now()}`,
        payload,
        response: res,
        at: new Date().toISOString(),
      };
      setDebugResult(res);
      setDebugHistory((prev) => [entry, ...prev].slice(0, 5));
    } catch (e: any) {
      setError(e instanceof Error ? e.message : t('errors.startImport'));
    } finally {
      setDebugRunning(false);
    }
  };

  const loadRuns = useCallback(async () => {
    try {
      setLoadingRuns(true);
      setError(null);
      const data = await fetchWithToken<{ runs?: ImportRun[]; jobs?: any[] }>(
        "/api/admin/import/queue"
      );
      const runsList = data.runs || data.jobs || [];
      setRuns(runsList as ImportRun[]);
      if (runsList && runsList.length > 0) {
        setSelectedRun(runsList[0] as ImportRun);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadRuns"));
    } finally {
      setLoadingRuns(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isUserAdmin || !user || loading) return;
    loadRuns();
  }, [isUserAdmin, user, loading, loadRuns]);

  const loadRunDetail = async (id: string) => {
    try {
      setLoadingRunDetail(true);
      setError(null);
      const data = await fetchWithToken<ImportRun>(`/api/admin/import/queue/${id}`);
      setSelectedRun(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.loadRunDetail"));
    } finally {
      setLoadingRunDetail(false);
    }
  };

  const startImport = async () => {
    try {
      setStarting(true);
      setError(null);
      const payload: any = { 
        type: 'products', // NEW: specify import type
        maxItemsPerSubcategory: maxItems ? Number(maxItems) : 10,
        importerType, // NEW: specify importer method
      };

      const data = await fetchWithToken<{ success: boolean; jobId?: string; totalBatches?: number; message?: string }>(
        "/api/admin/import/start",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (data.jobId) {
        await loadRuns();
      }
      
      setError(null);
      alert(`✅ Import started! Job ID: ${data.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.startImport"));
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>{t("loading")}</p>
      </div>
    );
  }

  if (!isUserAdmin) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>{t("accessDenied")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-gray-500 mt-1">{t("subtitle")}</p>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("startCard.title")}</CardTitle>
            <CardDescription>{t("startCard.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("startCard.maxLabel")}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={maxItems}
                onChange={(e) => setMaxItems(e.target.value)}
                placeholder="20"
              />
              <p className="text-xs text-gray-500">Maksymalnie produktów na każdą pod-podkategorię</p>
            </div>
            
            <div className="space-y-2">
              <Label>Typ Importera (Eksperyment) 🧪</Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setImporterType('keyword-search')}
                  className={`text-left border rounded-md p-3 transition ${
                    importerType === 'keyword-search' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">🔍 Keyword Search (Obecny)</div>
                  <div className="text-xs text-gray-500 mt-1">
                    AI generuje keywords → wyszukuje produkty → filtry
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setImporterType('hot-products')}
                  className={`text-left border rounded-md p-3 transition ${
                    importerType === 'hot-products' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">🔥 Hot Products (AliExpress)</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Bezpośrednie bestsellery z AliExpress category IDs
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setImporterType('convertiser')}
                  className={`text-left border rounded-md p-3 transition ${
                    importerType === 'convertiser' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">🌍 Convertiser (Nowy!)</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Produkty z Convertiser API po pod-pod-kategoriach
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setImporterType('category-direct')}
                  className={`text-left border rounded-md p-3 transition ${
                    importerType === 'category-direct' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  disabled
                >
                  <div className="font-semibold text-gray-400">📂 Category Direct (Wkrótce)</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Przeglądanie kategorii bez keywords (w przygotowaniu)
                  </div>
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={startImport} disabled={starting}>
                {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                {t("startCard.start")}
              </Button>
              <Button variant="outline" onClick={loadRuns} disabled={loadingRuns}>
                <RefreshCw className="h-4 w-4 mr-2" /> {t("startCard.refresh")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("listCard.title")}</CardTitle>
            <CardDescription>{t("listCard.description", { limit: 20 })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRuns && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("listCard.loading")}
              </div>
            )}
            {!loadingRuns && runs.length === 0 && <p className="text-sm text-gray-500">{t("listCard.empty")}</p>}
            <div className="space-y-2 max-h-80 overflow-auto pr-1">
              {runs && runs.length > 0 ? (
                runs.map((run, idx) => (
                  <button
                    key={run?.id ?? `run-${run?.startedAt ?? ''}-${run?.source ?? ''}-${idx}`}
                    onClick={() => run?.id && loadRunDetail(run.id)}
                    className={`w-full text-left border rounded-md px-3 py-2 hover:border-primary transition ${
                      selectedRun?.id === run?.id ? "border-primary bg-primary/5" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">
                        {run?.type === 'products' ? '📦 Produkty' : '🆕 Okazje'} · {run?.source} 
                        {run?.importerType && ` · ${run?.importerType === 'hot-products' ? '🔥' : '🔍'}`}
                      </div>
                      <Badge variant={run?.status === "completed" ? "default" : run?.status === "failed" ? "destructive" : "outline"}>
                        {statusLabel(run?.status || 'unknown')}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex gap-3">
                      <span>{t("details.stats.fetched")}: {formatNumber(run?.stats?.fetched)}</span>
                      <span>{t("details.stats.created")}: {formatNumber(run?.stats?.created)}</span>
                      <span>{t("details.stats.errors")}: {formatNumber(run?.stats?.errors)}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{formatDateTime(run?.startedAt)}</div>
                  </button>
                ))
              ) : (
                !loadingRuns && <p className="text-sm text-gray-500">{t("listCard.empty")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debug: etapowy test importu */}
      <Card>
        <CardHeader>
          <CardTitle>Debug importu (API /import/debug)</CardTitle>
          <CardDescription>Uruchom pojedynczy etap lub całość i zobacz próbki</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Keywords (comma-separated)</Label>
              <Input value={debugKeywords} onChange={(e) => setDebugKeywords(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Importer Type</Label>
              <select
                className="w-full border rounded-md h-10 px-2"
                value={importerType}
                onChange={(e) => setImporterType(e.target.value as any)}
              >
                <option value="keyword-search">🔍 Keyword Search</option>
                <option value="hot-products">🔥 Hot Products</option>
                <option value="convertiser">🌍 Convertiser</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Stage</Label>
              <select
                className="w-full border rounded-md h-10 px-2"
                value={debugStage}
                onChange={(e) => setDebugStage(e.target.value as any)}
              >
                <option value="fetch">fetch</option>
                <option value="dedupe">dedupe</option>
                <option value="enrich">enrich</option>
                <option value="translate">translate</option>
                <option value="save">save</option>
                <option value="all">all</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Max products</Label>
              <Input type="number" min={1} max={200} value={debugMaxProducts} onChange={(e) => setDebugMaxProducts(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sample size</Label>
              <Input type="number" min={1} max={20} value={debugSampleSize} onChange={(e) => setDebugSampleSize(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category (EN)</Label>
              <Input value={debugCategory} onChange={(e) => setDebugCategory(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Subcategory (EN)</Label>
              <Input value={debugSubcategory} onChange={(e) => setDebugSubcategory(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Subsubcategory (EN)</Label>
              <Input value={debugSubsubcategory} onChange={(e) => setDebugSubsubcategory(e.target.value)} placeholder="opcjonalne" />
            </div>
            <div className="space-y-2">
              <Label>Opcje</Label>
              <div className="flex items-center gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={debugTranslate} onChange={(e) => setDebugTranslate(e.target.checked)} />
                  Translate to PL
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={debugWriteToDb} onChange={(e) => setDebugWriteToDb(e.target.checked)} />
                  Write to DB
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={runDebug} disabled={debugRunning}>
              {debugRunning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Uruchom debug
            </Button>
            <Button variant="outline" onClick={() => setDebugResult(null)}>
              Wyczyść wynik
            </Button>
          </div>

          {debugResult && (
            <div className="border rounded-md p-3 bg-slate-50">
              <div className="text-sm font-semibold mb-2">Ostatni wynik</div>
              <pre className="text-xs whitespace-pre-wrap break-words max-h-96 overflow-auto">{JSON.stringify(debugResult, null, 2)}</pre>
            </div>
          )}

          {debugHistory.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">Historia (ostatnie 5)</div>
              <div className="space-y-2">
                {debugHistory.map((h) => (
                  <div key={h.id} className="border rounded-md p-3 bg-white">
                    <div className="text-xs text-gray-500 mb-1">{new Date(h.at).toLocaleString()}</div>
                    <pre className="text-xs whitespace-pre-wrap break-words max-h-48 overflow-auto">{JSON.stringify(h.response, null, 2)}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRun && (
        <Card>
          <CardHeader>
            <CardTitle>{t("details.title")}</CardTitle>
            <CardDescription>{t("details.runId")}: {selectedRun.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRunDetail && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("listCard.loading")}
              </div>
            )}
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="space-y-1">
                <p className="font-semibold">Źródło</p>
                <p className="text-gray-600">
                  {selectedRun.type === 'products' ? 'Produkty' : 'Okazje'} · {selectedRun.source}
                  {selectedRun.importerType && ` · ${selectedRun.importerType}`}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">{t("details.status")}</p>
                <p className="text-gray-600">
                  {statusLabel(selectedRun.status)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">{t("details.time")}</p>
                <p className="text-gray-600">
                  {formatDateTime(selectedRun.startedAt)}
                  {selectedRun.finishedAt ? ` → ${formatDateTime(selectedRun.finishedAt)}` : ""}
                  {selectedRun.durationMs ? ` (${formatDuration(selectedRun.durationMs)})` : ""}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <Stat label={t("details.stats.fetched")}
                   value={formatNumber(selectedRun.stats?.fetched)} />
              <Stat label={t("details.stats.created")}
                   value={formatNumber(selectedRun.stats?.created)} />
              <Stat label={t("details.stats.updated")}
                   value={formatNumber(selectedRun.stats?.updated)} />
              <Stat label={t("details.stats.skipped")}
                   value={formatNumber(selectedRun.stats?.skipped)} />
              <Stat label={t("details.stats.errors")}
                   value={formatNumber(selectedRun.stats?.errors)} />
              <Stat label={t("details.stats.duplicates")}
                   value={formatNumber(selectedRun.stats?.duplicates ?? 0)} />
            </div>

            {selectedRun.errorSummary && selectedRun.errorSummary.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold">{t("details.errorsTitle")}</p>
                <div className="space-y-1 text-sm text-gray-700">
                  {selectedRun.errorSummary.map((err, idx) => (
                    <div key={`${err.code}-${idx}`} className="border rounded-md px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{err.code}</span>
                        {err.itemId && <Badge variant="outline">{t("details.item")}: {err.itemId}</Badge>}
                      </div>
                      <p className="text-gray-600 text-sm mt-1">{err.message}</p>
                      {err.timestamp && <p className="text-xs text-gray-400 mt-1">{formatDateTime(err.timestamp)}</p>}
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

function Stat({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value ?? 0}</p>
    </div>
  );
}
