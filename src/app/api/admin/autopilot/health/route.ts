import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const SETTINGS_DOC_PATH = 'admin_meta/aliexpress-autopilot-settings';
const LOCK_DOC_PATH = 'admin_meta/aliexpress-sync-lock';
const RUNTIME_DOC_PATH = 'admin_meta/aliexpress-autopilot-runtime';
const SCHEDULER_STALE_MS = 20 * 60 * 1000;
const AUTOPILOT_RUNTIME_HISTORY_COLLECTION = 'aliexpress_autopilot_runs';
const AUTOMATION_ALERTS_COLLECTION = 'automation_alerts';
const HARVESTER_JOBS_COLLECTION = 'harvester_jobs';

const TELEMETRY_STAGE_KEYS = [
  'fetch',
  'aiCategorization',
  'processing',
  'moderation',
  'bestPriceRecalc',
  'dealRefinerBatch',
  'finalDealRefiner',
  'finalProductRefiner',
] as const;

type TelemetryStageKey = (typeof TELEMETRY_STAGE_KEYS)[number];

type RuntimeHistoryEntry = {
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
  httpStatus?: number;
};

type AutomationAlert = {
  id: string;
  code: string;
  severity: 'warning' | 'error';
  title: string;
  message: string;
  createdAt: string;
  resolved?: boolean;
};

type HarvesterStageTotals = Record<TelemetryStageKey, number>;

type HarvesterTelemetry = {
  stageTotalsMs?: Partial<HarvesterStageTotals>;
};

type HarvesterJobHealthView = {
  id: string;
  source?: string;
  status?: string;
  startedAt?: string;
  telemetry?: HarvesterTelemetry;
};

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function buildSlaSummary(entries: RuntimeHistoryEntry[]) {
  const effectiveRuns = entries.filter((entry) => !entry.skipped);
  const successfulRuns = effectiveRuns.filter((entry) => entry.ok && entry.status === 'completed');
  const failedRuns = effectiveRuns.filter((entry) => !entry.ok || entry.status === 'failed');
  const skippedRuns = entries.filter((entry) => entry.skipped);

  let consecutiveFailures = 0;
  for (const entry of entries) {
    if (entry.skipped) continue;
    if (entry.ok && entry.status === 'completed') break;
    consecutiveFailures += 1;
  }

  const avgDurationMs = effectiveRuns.length > 0
    ? Math.round(effectiveRuns.reduce((sum, entry) => sum + toFiniteNumber(entry.durationMs), 0) / effectiveRuns.length)
    : 0;

  return {
    windowHours: 24,
    totalRuns: entries.length,
    effectiveRuns: effectiveRuns.length,
    successfulRuns: successfulRuns.length,
    failedRuns: failedRuns.length,
    skippedRuns: skippedRuns.length,
    successRatePercent: effectiveRuns.length > 0 ? Math.round((successfulRuns.length / effectiveRuns.length) * 100) : null,
    avgDurationMs,
    consecutiveFailures,
    lastSuccessAt: successfulRuns[0]?.completedAt || successfulRuns[0]?.triggeredAt || null,
    lastFailureAt: failedRuns[0]?.completedAt || failedRuns[0]?.triggeredAt || null,
  };
}

function buildTopStageRanking(entries: HarvesterJobHealthView[]) {
  const aggregates = new Map<TelemetryStageKey, {
    totalMs: number;
    samples: number;
    maxMs: number;
  }>();

  TELEMETRY_STAGE_KEYS.forEach((stage) => {
    aggregates.set(stage, {
      totalMs: 0,
      samples: 0,
      maxMs: 0,
    });
  });

  for (const entry of entries) {
    const stageTotals = entry.telemetry?.stageTotalsMs;
    if (!stageTotals) continue;

    TELEMETRY_STAGE_KEYS.forEach((stage) => {
      const value = toFiniteNumber(stageTotals[stage]);
      if (value <= 0) return;

      const existing = aggregates.get(stage);
      if (!existing) return;

      existing.totalMs += value;
      existing.samples += 1;
      existing.maxMs = Math.max(existing.maxMs, value);
    });
  }

  return [...aggregates.entries()]
    .map(([stage, value]) => ({
      stage,
      totalMs: Math.round(value.totalMs),
      avgMs: value.samples > 0 ? Math.round(value.totalMs / value.samples) : 0,
      maxMs: Math.round(value.maxMs),
      samples: value.samples,
    }))
    .filter((entry) => entry.totalMs > 0)
    .sort((left, right) => right.totalMs - left.totalMs)
    .slice(0, 5);
}

type HealthIssue = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
};

function envFlag(name: string): boolean {
  return String(process.env[name] || '').trim().length > 0;
}

export async function GET() {
  try {
    await requireAdmin();

    const [
      settingsSnap,
      lockSnap,
      runtimeSnap,
      enabledProfilesSnap,
      allProfilesSnap,
      lastRunSnap,
      runtimeHistorySnap,
      alertsSnap,
      harvesterJobsSnap,
    ] = await Promise.all([
      adminDb.doc(SETTINGS_DOC_PATH).get(),
      adminDb.doc(LOCK_DOC_PATH).get(),
      adminDb.doc(RUNTIME_DOC_PATH).get(),
      adminDb.collection('importProfiles')
        .where('vendorId', '==', 'aliexpress')
        .where('enabled', '==', true)
        .get(),
      adminDb.collection('importProfiles')
        .where('vendorId', '==', 'aliexpress')
        .get(),
      adminDb.collection('importRuns')
        .where('vendorId', '==', 'aliexpress')
        .orderBy('startedAt', 'desc')
        .limit(1)
        .get(),
      adminDb.collection(AUTOPILOT_RUNTIME_HISTORY_COLLECTION)
        .orderBy('triggeredAt', 'desc')
        .limit(24)
        .get(),
      adminDb.collection(AUTOMATION_ALERTS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get(),
      adminDb.collection(HARVESTER_JOBS_COLLECTION)
        .orderBy('startedAt', 'desc')
        .limit(200)
        .get(),
    ]);

    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const lockData = lockSnap.exists ? lockSnap.data() : {};
    const runtimeData = runtimeSnap.exists ? runtimeSnap.data() : {};

    const lockedUntilRaw = String(lockData?.lockedUntil || '');
    const lockedUntilMs = Date.parse(lockedUntilRaw);
    const lockActive = Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now();

    const lastRun = lastRunSnap.empty
      ? null
      : {
          id: lastRunSnap.docs[0].id,
          ...(lastRunSnap.docs[0].data() as Record<string, unknown>),
        };

    const schedulerLastTriggerAt = String(runtimeData?.triggeredAt || '');
    const schedulerLastTriggerMs = Date.parse(schedulerLastTriggerAt);
    const schedulerStale =
      Number.isFinite(schedulerLastTriggerMs) &&
      Date.now() - schedulerLastTriggerMs > SCHEDULER_STALE_MS;

    const cronSecretConfigured =
      envFlag('CRON_SECRET') ||
      envFlag('IMPORT_ADMIN_TOKEN') ||
      envFlag('ADMIN_BEARER');

    const aliexpressTokenConfigured = envFlag('ALIEXPRESS_ACCESS_TOKEN');

    const issues: HealthIssue[] = [];
    const runtimeHistory = runtimeHistorySnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as RuntimeHistoryEntry),
    }));
    const recentAlerts = alertsSnap.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<AutomationAlert, 'id'> & { source?: string }),
      }))
      .filter((alert) => alert.source === 'aliexpress-autopilot')
      .slice(0, 10);
    const sla24h = buildSlaSummary(runtimeHistory);
    const telemetryWindowStart = Date.now() - 24 * 60 * 60 * 1000;
    const recentHarvesterJobs = harvesterJobsSnap.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<HarvesterJobHealthView, 'id'>),
      }))
      .filter((job) => {
        if (job.source !== 'aliexpress') return false;
        const startedAtMs = Date.parse(String(job.startedAt || ''));
        if (!Number.isFinite(startedAtMs)) return false;
        return startedAtMs >= telemetryWindowStart;
      });
    const topStages24h = buildTopStageRanking(recentHarvesterJobs);

    if (settings?.enabled === false) {
      issues.push({
        code: 'AUTOPILOT_DISABLED',
        severity: 'warning',
        message: 'Autopilot jest wylaczony w ustawieniach.',
      });
    }

    if (enabledProfilesSnap.size === 0) {
      issues.push({
        code: 'NO_ENABLED_PROFILES',
        severity: 'error',
        message: 'Brak aktywnych profili AliExpress. Uruchom Bootstrap profili.',
      });
    }

    if (!cronSecretConfigured) {
      issues.push({
        code: 'CRON_AUTH_NOT_CONFIGURED',
        severity: 'warning',
        message: 'Brak skonfigurowanego sekretu cron. Trigger cron moze byc nieautoryzowany.',
      });
    }

    if (!aliexpressTokenConfigured) {
      issues.push({
        code: 'ALIEXPRESS_TOKEN_MISSING',
        severity: 'warning',
        message: 'Brak ALIEXPRESS_ACCESS_TOKEN w env. Import moze sie nie powiesc.',
      });
    }

    if (!lastRun) {
      issues.push({
        code: 'NO_RUN_HISTORY',
        severity: 'info',
        message: 'Brak historii importRuns dla AliExpress.',
      });
    }

    if (!runtimeSnap.exists) {
      issues.push({
        code: 'SCHEDULER_RUNTIME_MISSING',
        severity: 'warning',
        message: 'Brak raportu runtime z Firebase Scheduler. Sprawdz trigger scheduleAliExpressSync.',
      });
    }

    if (runtimeData?.status === 'failed') {
      issues.push({
        code: 'SCHEDULER_LAST_RUN_FAILED',
        severity: 'error',
        message: `Ostatni trigger Firebase Scheduler zakonczyl sie bledem: ${String(runtimeData?.error || 'brak szczegolow')}`,
      });
    }

    if (runtimeSnap.exists && schedulerStale) {
      issues.push({
        code: 'SCHEDULER_RUN_STALE',
        severity: 'warning',
        message: 'Brak swiezego triggera Scheduler od ponad 20 minut.',
      });
    }

    if (sla24h.consecutiveFailures >= 2) {
      issues.push({
        code: 'SCHEDULER_CONSECUTIVE_FAILURES',
        severity: 'error',
        message: `Autopilot zanotowal ${sla24h.consecutiveFailures} kolejne nieudane przebiegi.`,
      });
    }

    if (sla24h.successRatePercent !== null && sla24h.successRatePercent < 80) {
      issues.push({
        code: 'SCHEDULER_SLA_DEGRADED',
        severity: 'warning',
        message: `SLA 24h spadl do ${sla24h.successRatePercent}%.`,
      });
    }

    return NextResponse.json({
      success: true,
      health: {
        autopilotEnabled: settings?.enabled !== false,
        ensureProfiles: settings?.ensureProfiles === true,
        autoApprove: typeof settings?.autoApprove === 'boolean' ? settings.autoApprove : true,
        lockActive,
        lockUntil: lockData?.lockedUntil || null,
        cronSecretConfigured,
        aliexpressTokenConfigured,
        profiles: {
          enabled: enabledProfilesSnap.size,
          total: allProfilesSnap.size,
        },
        scheduler: runtimeSnap.exists
          ? {
              status: runtimeData?.status || 'unknown',
              ok: Boolean(runtimeData?.ok),
              triggeredAt: runtimeData?.triggeredAt || null,
              completedAt: runtimeData?.completedAt || null,
              durationMs: Number(runtimeData?.durationMs || 0),
              synced: Number(runtimeData?.synced || 0),
              total: Number(runtimeData?.total || 0),
              failed: Number(runtimeData?.failed || 0),
              skipped: Boolean(runtimeData?.skipped),
              stale: Boolean(schedulerStale),
              message: runtimeData?.message || null,
              error: runtimeData?.error || null,
            }
          : null,
        sla24h,
        recentRuns: runtimeHistory,
        performance24h: {
          windowHours: 24,
          jobsAnalyzed: recentHarvesterJobs.length,
          topStages: topStages24h,
        },
        recentAlerts,
        lastRun,
        issues,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('Unauthorized') || message.includes('Forbidden')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message,
        },
        { status: 403 }
      );
    }

    logger.error('Autopilot health check failed', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Autopilot health failed',
        message,
      },
      { status: 500 }
    );
  }
}
