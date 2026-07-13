import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const SETTINGS_DOC_PATH = 'admin_meta/aliexpress-autopilot-settings';
const LOCK_DOC_PATH = 'admin_meta/aliexpress-sync-lock';

/**
 * GET /api/admin/autopilot-state
 * Lightweight status endpoint used by ImportStatusBar.
 * Returns: enabled, lockedUntil, lastRunAt, lastResult.
 */
export async function GET() {
  try {
    await requireAdmin();

    const [settingsSnap, lockSnap, lastRunSnap] = await Promise.all([
      adminDb.doc(SETTINGS_DOC_PATH).get(),
      adminDb.doc(LOCK_DOC_PATH).get(),
      adminDb
        .collection('importRuns')
        .where('vendorId', '==', 'aliexpress')
        .orderBy('startedAt', 'desc')
        .limit(1)
        .get(),
    ]);

    const settings = settingsSnap.exists ? (settingsSnap.data() as Record<string, unknown>) : {};
    const lock = lockSnap.exists ? (lockSnap.data() as Record<string, unknown>) : {};

    const enabled = settings?.enabled !== false;
    const lockedUntil = typeof lock?.lockedUntil === 'string' ? lock.lockedUntil : null;

    let lastRunAt: string | null = null;
    let lastResult: { created?: number; updated?: number; skipped?: number } | null = null;

    if (!lastRunSnap.empty) {
      const run = lastRunSnap.docs[0].data() as Record<string, unknown>;
      lastRunAt = typeof run?.startedAt === 'string' ? run.startedAt : null;

      const stats = (run?.stats ?? run?.telemetry) as Record<string, unknown> | undefined;
      if (stats && typeof stats === 'object') {
        lastResult = {
          created: typeof stats.createdDeals === 'number' ? stats.createdDeals : (typeof stats.productsCreated === 'number' ? stats.productsCreated : 0),
          updated: typeof stats.updatedDeals === 'number' ? stats.updatedDeals : 0,
          skipped: typeof stats.duplicatesSkipped === 'number' ? stats.duplicatesSkipped : 0,
        };
      }
    }

    return NextResponse.json({ enabled, lockedUntil, lastRunAt, lastResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Unauthorized') || message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Unauthorized', message }, { status: 403 });
    }
    logger.error('autopilot-state fetch failed', { error });
    return NextResponse.json({ error: 'Failed', message }, { status: 500 });
  }
}
