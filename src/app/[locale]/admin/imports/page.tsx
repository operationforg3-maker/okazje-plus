"use client";

import { useEffect, useMemo, useState } from "react";
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
  const t = useTranslations("adminImports");
  const format = useFormatter();
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

  const formatDateTime = (value?: string) =>
    value ? format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" }) : t("details.noData");

  const formatDuration = (ms?: number) =>
    ms ? `${Math.round(ms / 1000)}s` : "";

  const formatNumber = (value?: number) => format.number(value ?? 0);

  const statusLabel = (status: ImportRun["status"]) => t(`statusMap.${status}` as any);

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
      setError(e instanceof Error ? e.message : t("errors.loadRuns"));
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
      setError(e instanceof Error ? e.message : t("errors.loadRunDetail"));
    } finally {
      setLoadingRunDetail(false);
    }
  };

  const startImport = async () => {
    if (!profileId) {
      setError(t("errors.profileRequired"));
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
              <Label>{t("startCard.profileLabel")}</Label>
              <Input
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                placeholder={t("startCard.profilePlaceholder")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("startCard.maxLabel")}</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxItems}
                  onChange={(e) => setMaxItems(e.target.value)}
                  placeholder={t("startCard.maxPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("startCard.modeLabel")}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={dryRun ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDryRun(true)}
                  >
                    {t("startCard.dryRun")}
                  </Button>
                  <Button
                    type="button"
                    variant={!dryRun ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDryRun(false)}
                  >
                    {t("startCard.real")}
                  </Button>
                </div>
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
                      {statusLabel(run.status)}
                      {run.dryRun ? t("dryRunSuffix") : ""}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex gap-3">
                    <span>{t("details.stats.fetched")}: {formatNumber(run.stats?.fetched)}</span>
                    <span>{t("details.stats.created")}: {formatNumber(run.stats?.created)}</span>
                    <span>{t("details.stats.errors")}: {formatNumber(run.stats?.errors)}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{formatDateTime(run.startedAt)}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
                <p className="font-semibold">{t("details.profileVendor")}</p>
                <p className="text-gray-600">{selectedRun.profileId} · {selectedRun.vendorId}</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">{t("details.status")}</p>
                <p className="text-gray-600">
                  {statusLabel(selectedRun.status)}
                  {selectedRun.dryRun ? t("dryRunSuffix") : ""}
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
