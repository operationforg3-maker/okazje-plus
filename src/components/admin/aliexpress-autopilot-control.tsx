"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Save, Play, Layers, ShieldCheck, AlertTriangle, Info, Activity } from 'lucide-react';

type Settings = {
  enabled: boolean;
  ensureProfiles: boolean;
  autoApprove: boolean;
  maxProfilesPerRun: number;
  maxItemsPerProfile: number;
  hardCap: number;
  pageSize: number;
  maxPages: number;
  defaultProfileMaxItems: number;
  // Hot Stream
  hotStreamEnabled: boolean;
  hotStreamGlobalLimit: number;
  hotStreamPerCategoryLimit: number;
  // Super Deals
  superDealsEnabled: boolean;
  superDealsMaxPromos: number;
  updatedAt?: string;
  updatedBy?: string;
};

const DEFAULTS: Settings = {
  enabled: true,
  ensureProfiles: false,
  autoApprove: true,
  maxProfilesPerRun: 3,
  maxItemsPerProfile: 20,
  hardCap: 5000,
  pageSize: 50,
  maxPages: 100,
  defaultProfileMaxItems: 20,
  // Hot Stream
  hotStreamEnabled: false,
  hotStreamGlobalLimit: 50,
  hotStreamPerCategoryLimit: 10,
  // Super Deals
  superDealsEnabled: true,
  superDealsMaxPromos: 2,
};

type HealthIssue = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
};

type SchedulerState = {
  status: string;
  ok: boolean;
  triggeredAt: string | null;
  completedAt: string | null;
  durationMs: number;
  synced: number;
  total: number;
  failed: number;
  skipped: boolean;
  stale: boolean;
  message: string | null;
  error: string | null;
};

type SlaState = {
  windowHours: number;
  totalRuns: number;
  effectiveRuns: number;
  successfulRuns: number;
  failedRuns: number;
  skippedRuns: number;
  successRatePercent: number | null;
  avgDurationMs: number;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
};

type RecentRunState = {
  id?: string;
  status?: string;
  ok?: boolean;
  triggeredAt?: string | null;
  completedAt?: string | null;
  durationMs?: number;
  synced?: number;
  total?: number;
  failed?: number;
  skipped?: boolean;
  message?: string | null;
  error?: string | null;
};

type AlertState = {
  id: string;
  code: string;
  severity: 'warning' | 'error';
  title: string;
  message: string;
  createdAt: string;
  resolved?: boolean;
};

type HealthState = {
  autopilotEnabled: boolean;
  ensureProfiles: boolean;
  autoApprove: boolean;
  lockActive: boolean;
  lockUntil: string | null;
  cronSecretConfigured: boolean;
  aliexpressTokenConfigured: boolean;
  profiles: {
    enabled: number;
    total: number;
  };
  scheduler: SchedulerState | null;
  sla24h: SlaState;
  performance24h?: {
    windowHours: number;
    jobsAnalyzed: number;
    topStages: Array<{
      stage: string;
      totalMs: number;
      avgMs: number;
      maxMs: number;
      samples: number;
    }>;
  };
  recentRuns: RecentRunState[];
  recentAlerts: AlertState[];
  lastRun: Record<string, any> | null;
  issues: HealthIssue[];
};

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    fetch: 'Pobieranie źródła',
    aiCategorization: 'AI kategoryzacja',
    processing: 'Przetwarzanie wsadu',
    moderation: 'Kolejka moderacji',
    bestPriceRecalc: 'Przeliczenie bestPrice',
    dealRefinerBatch: 'Deal Refiner batch',
    finalDealRefiner: 'Deal Refiner końcowy',
    finalProductRefiner: 'Product Refiner końcowy',
  };

  return labels[stage] || stage;
}

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'brak';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'brak';
  return date.toLocaleString('pl-PL');
}

export function AliExpressAutopilotControl({
  authToken,
  setAuthError,
  onActionDone,
}: {
  authToken: string | null;
  setAuthError: (message: string | null) => void;
  onActionDone?: () => void;
}) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [health, setHealth] = useState<HealthState | null>(null);
  const [message, setMessage] = useState<string>('');

  const canAct = useMemo(() => Boolean(authToken), [authToken]);

  const lastRunStats = useMemo(() => {
    if (!health?.lastRun || typeof health.lastRun !== 'object') return {} as Record<string, unknown>;
    const stats = (health.lastRun as any).stats;
    return stats && typeof stats === 'object' ? stats : {};
  }, [health?.lastRun]);

  const lastRunTelemetry = useMemo(() => {
    if (!health?.lastRun || typeof health.lastRun !== 'object') return {} as Record<string, unknown>;
    const telemetry = (health.lastRun as any).telemetry;
    return telemetry && typeof telemetry === 'object' ? telemetry : {};
  }, [health?.lastRun]);

  const lastRunCreatedProducts = toSafeNumber(lastRunTelemetry.createdProducts ?? lastRunStats.createdProducts);
  const lastRunCreatedDeals = toSafeNumber(lastRunTelemetry.createdDeals ?? lastRunStats.createdDeals);
  const lastRunUniqueShare = toSafeNumber(lastRunTelemetry.uniqueSharePercent ?? lastRunStats.uniqueSharePercent);
  const lastRunUniquePool = toSafeNumber(lastRunTelemetry.uniqueProductsInPool ?? lastRunStats.uniqueProductsInPool);
  const lastRunDuplicatePool = toSafeNumber(lastRunTelemetry.duplicateProductsInPool ?? lastRunStats.duplicateProductsInPool);
  const lastRunSearchMethod = String(lastRunTelemetry.searchMethod ?? lastRunStats.searchMethod ?? '').trim();

  const loadSettings = async () => {
    if (!authToken) {
      setAuthError('Brak tokenu administratora. Zaloguj się ponownie.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/autopilot/settings', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się pobrać ustawień');
      }

      setSettings({ ...DEFAULTS, ...(data.settings || {}) });
      setAuthError(null);
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const loadHealth = async () => {
    if (!authToken) {
      setAuthError('Brak tokenu administratora. Zaloguj się ponownie.');
      return;
    }

    setHealthLoading(true);
    try {
      const res = await fetch('/api/admin/autopilot/health', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udalo sie pobrac diagnostyki autopilota');
      }

      setHealth(data.health as HealthState);
      setAuthError(null);
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    if (authToken) {
      void loadSettings();
      void loadHealth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const saveSettings = async () => {
    if (!authToken) return;

    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/autopilot/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się zapisać ustawień');
      }

      setSettings((prev) => ({ ...prev, ...(data.settings || {}) }));
      setMessage('✅ Ustawienia zapisane.');
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const runAutopilotNow = async () => {
    if (!authToken) return;

    setRunning(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/autopilot/run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxItemsPerProfile: settings.maxItemsPerProfile,
          autoApprove: settings.autoApprove,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Nie udało się uruchomić autopilota');
      }

      setMessage(`✅ Autopilot uruchomiony. Profile: ${data.total}, sukces: ${data.successful}.`);
      void loadHealth();
      onActionDone?.();
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunning(false);
    }
  };

  const bootstrapProfiles = async (dryRun: boolean) => {
    if (!authToken) return;

    setBootstrapping(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/autopilot/bootstrap-profiles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun, maxItemsPerRun: settings.defaultProfileMaxItems }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Bootstrap zakończony błędem');
      }

      const result = data.result || {};
      setMessage(
        `✅ Bootstrap ${dryRun ? '(dry-run)' : ''}: utworzono ${result.createdProfiles || 0}, pominięto ${result.skippedProfiles || 0}, targetów ${result.totalTargets || 0}.`
      );
      void loadHealth();
      onActionDone?.();
    } catch (error) {
      setMessage(`❌ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBootstrapping(false);
    }
  };

  const updateNumber = (key: keyof Settings, value: string) => {
    const parsed = Number(value);
    setSettings((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  return (
    <Card className="bg-white border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          AliExpress Autopilot - Sterowanie UX
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 bg-slate-50">
            <p className="text-sm font-semibold">Autopilot aktywny</p>
            <p className="text-xs text-slate-600 mt-1">
              Uruchamia import ze wszystkich aktywnych profili AliExpress i zapisuje wyniki do importRuns.
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-slate-50">
            <p className="text-sm font-semibold">Bootstrap profili</p>
            <p className="text-xs text-slate-600 mt-1">
              Tworzy brakujace profile importu dla kategorii L3, aby kazda kategoria miala zrodlo danych.
            </p>
          </div>
          <div className="rounded-lg border p-3 bg-slate-50">
            <p className="text-sm font-semibold">Diagnostyka</p>
            <p className="text-xs text-slate-600 mt-1">
              Pokazuje gotowosc: token API, liczbe profili, lock sync oraz ostatni run.
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Stan mechanizmu Autopilot
            </p>
            <Button variant="outline" size="sm" onClick={loadHealth} disabled={!canAct || healthLoading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${healthLoading ? 'animate-spin' : ''}`} />
              Odswiez stan
            </Button>
          </div>

          {health && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
              <Badge variant={health.autopilotEnabled ? 'default' : 'destructive'}>
                Autopilot: {health.autopilotEnabled ? 'wlaczony' : 'wylaczony'}
              </Badge>
              <Badge variant={health.profiles.enabled > 0 ? 'default' : 'destructive'}>
                Profile: {health.profiles.enabled}/{health.profiles.total}
              </Badge>
              <Badge variant={health.autoApprove ? 'default' : 'secondary'}>
                Auto-approve: {health.autoApprove ? 'wlaczony' : 'wylaczony'}
              </Badge>
              <Badge variant={health.aliexpressTokenConfigured ? 'default' : 'destructive'}>
                Token API: {health.aliexpressTokenConfigured ? 'OK' : 'BRAK'}
              </Badge>
              <Badge variant={health.lockActive ? 'secondary' : 'outline'}>
                Sync lock: {health.lockActive ? 'aktywny' : 'nieaktywny'}
              </Badge>
            </div>
          )}

          {health?.scheduler && (
            <div className="text-xs text-slate-600 rounded-md bg-amber-50 p-3 border border-amber-200 space-y-2">
              <div className="font-semibold text-slate-800">Runtime z Firebase Scheduler</div>
              <div>
                Status: {health.scheduler.status || 'unknown'} | trigger: {health.scheduler.triggeredAt ? new Date(health.scheduler.triggeredAt).toLocaleString('pl-PL') : 'brak'}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Synced profile</p>
                  <p className="font-semibold text-slate-900">{toSafeNumber(health.scheduler.synced)}</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Total profile</p>
                  <p className="font-semibold text-slate-900">{toSafeNumber(health.scheduler.total)}</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Failed profile</p>
                  <p className="font-semibold text-slate-900">{toSafeNumber(health.scheduler.failed)}</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Czas wykonania</p>
                  <p className="font-semibold text-slate-900">{Math.max(0, Math.round(toSafeNumber(health.scheduler.durationMs) / 1000))}s</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Pominiety run</p>
                  <p className="font-semibold text-slate-900">{health.scheduler.skipped ? 'tak' : 'nie'}</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Swiezosc triggera</p>
                  <p className="font-semibold text-slate-900">{health.scheduler.stale ? 'przeterminowany' : 'aktualny'}</p>
                </div>
              </div>
              {health.scheduler.message && (
                <div className="rounded border bg-white p-2 text-[11px]">
                  Wiadomosc: {health.scheduler.message}
                </div>
              )}
              {health.scheduler.error && (
                <div className="rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
                  Blad: {health.scheduler.error}
                </div>
              )}
            </div>
          )}

          {health?.sla24h && (
            <div className="rounded-lg border p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">SLA autopilota z ostatnich 24h</p>
                <Badge variant={toSafeNumber(health.sla24h.successRatePercent) >= 95 ? 'default' : toSafeNumber(health.sla24h.successRatePercent) >= 80 ? 'secondary' : 'destructive'}>
                  SLA: {health.sla24h.successRatePercent ?? 'brak'}%
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
                <div className="rounded border bg-slate-50 p-2">
                  <p className="text-slate-500">Uruchomienia</p>
                  <p className="font-semibold text-slate-900">{toSafeNumber(health.sla24h.totalRuns)}</p>
                </div>
                <div className="rounded border bg-slate-50 p-2">
                  <p className="text-slate-500">Skuteczne</p>
                  <p className="font-semibold text-slate-900">{toSafeNumber(health.sla24h.successfulRuns)}</p>
                </div>
                <div className="rounded border bg-slate-50 p-2">
                  <p className="text-slate-500">Nieudane</p>
                  <p className="font-semibold text-slate-900">{toSafeNumber(health.sla24h.failedRuns)}</p>
                </div>
                <div className="rounded border bg-slate-50 p-2">
                  <p className="text-slate-500">Pominiete</p>
                  <p className="font-semibold text-slate-900">{toSafeNumber(health.sla24h.skippedRuns)}</p>
                </div>
                <div className="rounded border bg-slate-50 p-2">
                  <p className="text-slate-500">Sredni czas</p>
                  <p className="font-semibold text-slate-900">{Math.max(0, Math.round(toSafeNumber(health.sla24h.avgDurationMs) / 1000))}s</p>
                </div>
                <div className="rounded border bg-slate-50 p-2">
                  <p className="text-slate-500">Seria awarii</p>
                  <p className="font-semibold text-slate-900">{toSafeNumber(health.sla24h.consecutiveFailures)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="rounded border bg-slate-50 p-2">Ostatni sukces: {formatDateTime(health.sla24h.lastSuccessAt)}</div>
                <div className="rounded border bg-slate-50 p-2">Ostatnia awaria: {formatDateTime(health.sla24h.lastFailureAt)}</div>
              </div>
            </div>
          )}

          {health?.performance24h && (
            <div className="rounded-lg border p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Najdroższe etapy (24h)</p>
                <Badge variant="secondary">Joby: {toSafeNumber(health.performance24h.jobsAnalyzed)}</Badge>
              </div>

              {health.performance24h.topStages.length === 0 ? (
                <div className="rounded border bg-slate-50 p-3 text-[11px] text-slate-600">
                  Brak danych telemetrycznych etapów z ostatnich 24h.
                </div>
              ) : (
                <div className="space-y-2">
                  {health.performance24h.topStages.map((stage, index) => (
                    <div key={`${stage.stage}-${index}`} className="rounded border bg-slate-50 p-3 text-[11px] text-slate-700">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-semibold text-slate-900">{index + 1}. {stageLabel(stage.stage)}</p>
                        <Badge variant="outline">{Math.max(0, Math.round(toSafeNumber(stage.totalMs) / 1000))}s łącznie</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>Średnio: {Math.max(0, Math.round(toSafeNumber(stage.avgMs) / 1000))}s</div>
                        <div>Maks: {Math.max(0, Math.round(toSafeNumber(stage.maxMs) / 1000))}s</div>
                        <div>Próbki: {toSafeNumber(stage.samples)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {health?.lastRun && (
            <div className="text-xs text-slate-600 rounded-md bg-slate-50 p-3 border space-y-2">
              <div>
                Ostatni run: status {String(health.lastRun.status || 'unknown')} | start {String(health.lastRun.startedAt || 'n/a')}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Nowe produkty</p>
                  <p className="font-semibold text-slate-900">{lastRunCreatedProducts}</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Nowe oferty</p>
                  <p className="font-semibold text-slate-900">{lastRunCreatedDeals}</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Udział unikalnych</p>
                  <p className="font-semibold text-slate-900">{lastRunUniqueShare}%</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Pula unikalnych</p>
                  <p className="font-semibold text-slate-900">{lastRunUniquePool}</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Pula duplikatów</p>
                  <p className="font-semibold text-slate-900">{lastRunDuplicatePool}</p>
                </div>
                <div className="rounded border bg-white p-2">
                  <p className="text-slate-500">Metoda wyszukiwania</p>
                  <p className="font-semibold text-slate-900">{lastRunSearchMethod || 'brak danych'}</p>
                </div>
              </div>
            </div>
          )}

          {health?.recentRuns?.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3 bg-white">
              <p className="font-semibold text-sm">Ostatnie przebiegi scheduler</p>
              <div className="space-y-2">
                {health.recentRuns.slice(0, 6).map((run) => (
                  <div key={run.id || `${run.triggeredAt}-${run.status}`} className="rounded border bg-slate-50 p-3 text-[11px] text-slate-700">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant={run.ok ? 'default' : 'destructive'}>{run.status || 'unknown'}</Badge>
                      {run.skipped ? <Badge variant="secondary">skipped</Badge> : null}
                      <span>Trigger: {formatDateTime(run.triggeredAt)}</span>
                      <span>Czas: {Math.max(0, Math.round(toSafeNumber(run.durationMs) / 1000))}s</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>Synced: {toSafeNumber(run.synced)}</div>
                      <div>Total: {toSafeNumber(run.total)}</div>
                      <div>Failed: {toSafeNumber(run.failed)}</div>
                    </div>
                    {run.message ? <div className="mt-2">Wiadomosc: {run.message}</div> : null}
                    {run.error ? <div className="mt-2 text-red-700">Blad: {run.error}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {health?.recentAlerts?.length > 0 && (
            <div className="rounded-lg border p-4 space-y-3 bg-red-50 border-red-200">
              <p className="font-semibold text-sm text-red-900">Ostatnie incydenty autopilota</p>
              <div className="space-y-2">
                {health.recentAlerts.map((alert) => (
                  <div key={alert.id} className="rounded border bg-white p-3 text-[11px] text-slate-700">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant={alert.severity === 'error' ? 'destructive' : 'secondary'}>{alert.code}</Badge>
                      <span>{formatDateTime(alert.createdAt)}</span>
                    </div>
                    <div className="font-semibold text-slate-900">{alert.title}</div>
                    <div>{alert.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {health?.issues && health.issues.length > 0 ? (
            <div className="space-y-2">
              {health.issues.map((issue) => (
                <Alert key={issue.code} variant={issue.severity === 'error' ? 'destructive' : 'default'}>
                  {issue.severity === 'error' ? <AlertTriangle className="h-4 w-4" /> : issue.severity === 'warning' ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                  <AlertDescription className="text-xs">{issue.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            health && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Mechanizm wyglada na gotowy do pracy. Mozesz uruchomic Autopilot teraz.
                </AlertDescription>
              </Alert>
            )
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Autopilot aktywny</p>
              <p className="text-xs text-slate-500">Cron importuje tylko gdy ta opcja jest wlaczona.</p>
            </div>
            <Switch checked={settings.enabled} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, enabled: value }))} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Auto-bootstrap profili</p>
              <p className="text-xs text-slate-500">Przed sync automatycznie dopina brakujace profile L3.</p>
            </div>
            <Switch checked={settings.ensureProfiles} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, ensureProfiles: value }))} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Auto-approve importu</p>
              <p className="text-xs text-slate-500">Autopilot zapisuje nowe oferty od razu jako approved zamiast draft.</p>
            </div>
            <Switch checked={settings.autoApprove} onCheckedChange={(value) => setSettings((prev) => ({ ...prev, autoApprove: value }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>maxProfilesPerRun</Label>
            <Input type="number" value={settings.maxProfilesPerRun} onChange={(e) => updateNumber('maxProfilesPerRun', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>maxItemsPerProfile</Label>
            <Input type="number" value={settings.maxItemsPerProfile} onChange={(e) => updateNumber('maxItemsPerProfile', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>hardCap</Label>
            <Input type="number" value={settings.hardCap} onChange={(e) => updateNumber('hardCap', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>defaultProfileMaxItems</Label>
            <Input type="number" value={settings.defaultProfileMaxItems} onChange={(e) => updateNumber('defaultProfileMaxItems', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>pageSize</Label>
            <Input type="number" value={settings.pageSize} onChange={(e) => updateNumber('pageSize', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>maxPages</Label>
            <Input type="number" value={settings.maxPages} onChange={(e) => updateNumber('maxPages', e.target.value)} />
          </div>
        </div>

        {/* Hot Stream */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-600" />
            <p className="font-semibold text-amber-800 text-sm">Hot Stream AliExpress</p>
            <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">Beta</Badge>
          </div>
          <p className="text-xs text-amber-700">
            Po keyword search cron pobiera bestsellery AliExpress (bez słów kluczowych)
            i AI automatycznie przydziela produkty do kategorii serwisu.
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Włącz Hot Stream</p>
              <p className="text-xs text-slate-500">Uruchamia Phase B po każdym keyword search runie.</p>
            </div>
            <Switch
              checked={settings.hotStreamEnabled}
              onCheckedChange={(value) => setSettings((prev) => ({ ...prev, hotStreamEnabled: value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">hotStreamGlobalLimit</Label>
              <Input
                type="number"
                min={0}
                max={500}
                value={settings.hotStreamGlobalLimit}
                onChange={(e) => updateNumber('hotStreamGlobalLimit', e.target.value)}
                disabled={!settings.hotStreamEnabled}
              />
              <p className="text-xs text-slate-500">Max produktów globalnych (0 = wyłącz globalny)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">hotStreamPerCategoryLimit</Label>
              <Input
                type="number"
                min={0}
                max={500}
                value={settings.hotStreamPerCategoryLimit}
                onChange={(e) => updateNumber('hotStreamPerCategoryLimit', e.target.value)}
                disabled={!settings.hotStreamEnabled}
              />
              <p className="text-xs text-slate-500">Max produktów per AliExpress category ID (0 = wyłącz)</p>
            </div>
          </div>
        </div>

        <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base text-amber-900 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Faza A: Priorytetowy import promowanych (Super Deals)
              </Label>
              <p className="text-sm text-amber-700/80">Pobiera najwyższej klasy okazje priorytetowo przed profilami.</p>
            </div>
            <Switch
              checked={settings.superDealsEnabled}
              onCheckedChange={(value) => setSettings((prev) => ({ ...prev, superDealsEnabled: value }))}
            />
          </div>
          <div className="space-y-1 w-1/2">
            <Label className="text-xs">superDealsMaxPromos</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={settings.superDealsMaxPromos}
              onChange={(e) => updateNumber('superDealsMaxPromos', e.target.value)}
              disabled={!settings.superDealsEnabled}
            />
            <p className="text-xs text-slate-500">Ilość kampanii do zaciągnięcia (rekomendowane: 2-3)</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadSettings} disabled={!canAct || loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Odswiez
          </Button>
          <Button onClick={saveSettings} disabled={!canAct || saving} className="gap-2">
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            Zapisz ustawienia
          </Button>
          <Button variant="secondary" onClick={runAutopilotNow} disabled={!canAct || running} className="gap-2">
            <Play className="w-4 h-4" />
            Uruchom teraz
          </Button>
          <Button variant="outline" onClick={() => bootstrapProfiles(true)} disabled={!canAct || bootstrapping}>
            Bootstrap dry-run
          </Button>
          <Button variant="outline" onClick={() => bootstrapProfiles(false)} disabled={!canAct || bootstrapping}>
            Bootstrap zapis
          </Button>
        </div>

        {settings.updatedAt && (
          <Badge variant="outline">Ostatnia zmiana: {new Date(settings.updatedAt).toLocaleString('pl-PL')}</Badge>
        )}

        {message && (
          <div className="rounded-md border p-3 text-sm bg-slate-50">{message}</div>
        )}
      </CardContent>
    </Card>
  );
}
