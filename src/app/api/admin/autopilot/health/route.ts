import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const SETTINGS_DOC_PATH = 'admin_meta/aliexpress-autopilot-settings';
const LOCK_DOC_PATH = 'admin_meta/aliexpress-sync-lock';

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
      enabledProfilesSnap,
      allProfilesSnap,
      lastRunSnap,
    ] = await Promise.all([
      adminDb.doc(SETTINGS_DOC_PATH).get(),
      adminDb.doc(LOCK_DOC_PATH).get(),
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
    ]);

    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const lockData = lockSnap.exists ? lockSnap.data() : {};

    const lockedUntilRaw = String(lockData?.lockedUntil || '');
    const lockedUntilMs = Date.parse(lockedUntilRaw);
    const lockActive = Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now();

    const lastRun = lastRunSnap.empty
      ? null
      : {
          id: lastRunSnap.docs[0].id,
          ...(lastRunSnap.docs[0].data() as Record<string, unknown>),
        };

    const cronSecretConfigured =
      envFlag('CRON_SECRET') ||
      envFlag('IMPORT_ADMIN_TOKEN') ||
      envFlag('ADMIN_BEARER');

    const aliexpressTokenConfigured = envFlag('ALIEXPRESS_ACCESS_TOKEN');

    const issues: HealthIssue[] = [];

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
