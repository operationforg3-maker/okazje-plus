import { NextRequest, NextResponse } from 'next/server';
import { SmartHarvester } from '@/lib/automation/harvester';
import { ensureAliExpressImportProfilesCoverage } from '@/lib/import-profiles-bootstrap';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

const LOCK_DOC_PATH = 'admin_meta/aliexpress-sync-lock';
const SETTINGS_DOC_PATH = 'admin_meta/aliexpress-autopilot-settings';
const STATE_DOC_PATH = 'admin_meta/aliexpress-autopilot-state';
const LOCK_TTL_MS = 25 * 60 * 1000;
const ENSURE_PROFILES_INTERVAL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_MAX_PROFILES_PER_RUN = 3;

function getBearerToken(authHeader: string | null): string {
  if (!authHeader) return '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const providedSecret =
    request.nextUrl.searchParams.get('secret') ||
    request.headers.get('x-cron-secret') ||
    getBearerToken(request.headers.get('authorization'));

  const expectedSecrets = [
    process.env.CRON_SECRET,
    process.env.IMPORT_ADMIN_TOKEN,
    process.env.ADMIN_BEARER,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  if (expectedSecrets.length > 0) {
    return expectedSecrets.includes(String(providedSecret || '').trim());
  }

  // Fail closed: jeśli sekrety nie są skonfigurowane, odrzucamy request.
  // Zapobiega to przypadkowemu otwarciu endpointu cron w środowisku prod.
  return false;
}

async function withSyncLock<T>(runner: () => Promise<T>): Promise<{ skipped: boolean; result?: T }> {
  const lockRef = adminDb.doc(LOCK_DOC_PATH);
  const now = Date.now();
  const lockUntil = new Date(now + LOCK_TTL_MS).toISOString();

  const acquired = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const data = snap.data() as { lockedUntil?: string } | undefined;
    const lockedUntilMs = Date.parse(data?.lockedUntil || '');
    const isLocked = Number.isFinite(lockedUntilMs) && lockedUntilMs > now;

    if (isLocked) {
      return false;
    }

    tx.set(
      lockRef,
      {
        lockedUntil: lockUntil,
        startedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      },
      { merge: true }
    );
    return true;
  });

  if (!acquired) {
    return { skipped: true };
  }

  try {
    const result = await runner();
    return { skipped: false, result };
  } finally {
    await lockRef.set(
      {
        lockedUntil: null,
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}

async function runAliExpressSync(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    logger.warn('Unauthorized cron request for AliExpress sync');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lockRun = await withSyncLock(async () => {
    logger.info('Starting scheduled AliExpress sync');

    const settingsSnap = await adminDb.doc(SETTINGS_DOC_PATH).get();
    const settings = settingsSnap.exists ? (settingsSnap.data() as any) : {};
    const stateRef = adminDb.doc(STATE_DOC_PATH);
    const stateSnap = await stateRef.get();
    const state = stateSnap.exists ? (stateSnap.data() as any) : {};

    if (settings?.enabled === false) {
      logger.info('AliExpress sync skipped: autopilot disabled in settings');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Autopilot AliExpress jest wyłączony w ustawieniach.',
      });
    }

    const maxItemsParam = Number(request.nextUrl.searchParams.get('maxItems') || settings?.maxItemsPerProfile || '0');
    const hardCap = Number(settings?.hardCap || process.env.ALIEXPRESS_SYNC_HARD_CAP || '5000');
    const normalizedHardCap = Number.isFinite(hardCap) ? Math.max(100, hardCap) : 5000;
    const maxItems = Number.isFinite(maxItemsParam) && maxItemsParam > 0
      ? Math.min(maxItemsParam, normalizedHardCap)
      : Number(settings?.maxItemsPerProfile || 500);

    const pageSize = Number(settings?.pageSize || process.env.ALIEXPRESS_SYNC_PAGE_SIZE || 50);
    const maxPages = Number(settings?.maxPages || process.env.ALIEXPRESS_SYNC_MAX_PAGES || 100);
    const autoApprove = typeof settings?.autoApprove === 'boolean' ? settings.autoApprove : true;
    const importStrategy = settings?.importStrategy === 'price_asc' ? 'price_asc' : 'bestsellers';
    const maxProfilesPerRunParam = Number(
      request.nextUrl.searchParams.get('maxProfiles') ||
        settings?.maxProfilesPerRun ||
        process.env.ALIEXPRESS_SYNC_MAX_PROFILES ||
        DEFAULT_MAX_PROFILES_PER_RUN
    );
    const maxProfilesPerRun = Number.isFinite(maxProfilesPerRunParam) && maxProfilesPerRunParam > 0
      ? Math.min(Math.max(1, Math.round(maxProfilesPerRunParam)), 25)
      : DEFAULT_MAX_PROFILES_PER_RUN;

    const lastEnsuredAtMs = Date.parse(String(state?.lastEnsuredAt || ''));
    const shouldEnsureProfiles =
      request.nextUrl.searchParams.get('ensureProfiles') === '1' ||
      (
        settings?.ensureProfiles === true &&
        (!Number.isFinite(lastEnsuredAtMs) || Date.now() - lastEnsuredAtMs >= ENSURE_PROFILES_INTERVAL_MS)
      ) ||
      process.env.ALIEXPRESS_AUTO_BOOTSTRAP_PROFILES === 'true';

    if (shouldEnsureProfiles) {
      const bootstrapResult = await ensureAliExpressImportProfilesCoverage({
        enabled: true,
        defaultStatus: 'approved',
        deduplicationStrategy: 'skip',
        maxItemsPerRun: maxItems,
        createdBy: 'cron',
      });

      logger.info('AliExpress profile coverage ensured', bootstrapResult);
      await stateRef.set(
        {
          lastEnsuredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    const profilesSnapshot = await adminDb
      .collection('importProfiles')
      .where('enabled', '==', true)
      .where('vendorId', '==', 'aliexpress')
      .get();

    if (profilesSnapshot.empty) {
      logger.info('No enabled AliExpress import profiles found');
      return NextResponse.json({
        success: true,
        message: 'No profiles to sync',
        synced: 0,
      });
    }

    const orderedProfileDocs = [...profilesSnapshot.docs].sort((left, right) => left.id.localeCompare(right.id));
    const lastProfileCursor = typeof state?.lastProfileCursor === 'string' ? state.lastProfileCursor.trim() : '';
    const cursorIndex = lastProfileCursor
      ? orderedProfileDocs.findIndex((doc) => doc.id === lastProfileCursor)
      : -1;
    const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    let selectedProfileDocs = orderedProfileDocs.slice(startIndex, startIndex + maxProfilesPerRun);
    let wrappedCursor = false;

    if (selectedProfileDocs.length === 0 && orderedProfileDocs.length > 0) {
      selectedProfileDocs = orderedProfileDocs.slice(0, maxProfilesPerRun);
      wrappedCursor = true;
    }

    const nextProfileCursor = selectedProfileDocs.at(-1)?.id || null;

    logger.info('AliExpress sync selected profile batch', {
      totalProfiles: orderedProfileDocs.length,
      selectedProfiles: selectedProfileDocs.length,
      maxProfilesPerRun,
      lastProfileCursor: lastProfileCursor || null,
      nextProfileCursor,
      wrappedCursor,
    });

    const results = [];
    for (const profileDoc of selectedProfileDocs) {
      const profile = { id: profileDoc.id, ...profileDoc.data() } as { id: string; name?: string; [key: string]: unknown };
      const profileQuery = String((profile as any)?.filters?.searchQuery || profile.name || '').trim();

      if (!profileQuery) {
        results.push({
          profileId: profile.id,
          name: profile.name,
          success: false,
          error: 'Profil nie ma searchQuery ani nazwy do użycia jako zapytanie.',
        });
        continue;
      }

      try {
        logger.info('Running sync for profile via SmartHarvester', {
          profileId: profile.id,
          name: profile.name ?? profile.id,
          query: profileQuery,
          maxItems,
          pageSize,
          maxPages,
          hardCap: normalizedHardCap,
          autoApprove,
          importStrategy,
        });

        const jobId = `cron_harvest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const harvester = new SmartHarvester(jobId);
        const jobResult = await harvester.harvestProducts(
          'aliexpress',
          profileQuery,
          maxItems,
          undefined,
          false,
          undefined,
          false,
          importStrategy
        );

        const success = jobResult.status === 'completed';
        const stats = {
          productsFound: jobResult.productsFound,
          productsCreated: jobResult.productsCreated,
          dealsCreated: jobResult.dealsCreated,
          dealsLinked: jobResult.dealsLinked,
          duplicatesSkipped: jobResult.duplicatesSkipped,
          errors: jobResult.errors.length,
          status: jobResult.status,
          jobId: jobResult.id,
        };

        results.push({
          profileId: profile.id,
          name: profile.name,
          success,
          stats,
        });

        logger.info('Profile sync completed', {
          profileId: profile.id,
          stats,
        });
      } catch (error) {
        logger.error('Profile sync failed', {
          profileId: profile.id,
          error: error instanceof Error ? error.message : String(error),
        });

        results.push({
          profileId: profile.id,
          name: profile.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    logger.info('Scheduled AliExpress sync completed', {
      total: totalCount,
      availableProfiles: orderedProfileDocs.length,
      successful: successCount,
      failed: totalCount - successCount,
      nextProfileCursor,
    });

    await stateRef.set(
      {
        lastProfileCursor: nextProfileCursor,
        lastBatchAt: new Date().toISOString(),
        lastBatchSize: selectedProfileDocs.length,
        maxProfilesPerRun,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      synced: successCount,
      total: totalCount,
      availableProfiles: orderedProfileDocs.length,
      processedProfiles: selectedProfileDocs.length,
      nextProfileCursor,
      results,
    });
  });

  if (lockRun.skipped) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message: 'AliExpress sync already running',
    });
  }

  return lockRun.result as NextResponse;
}

/**
 * GET /api/cron/aliexpress-sync
 * 
 * Scheduled cron job to refresh AliExpress products/deals
 * - Fetches latest prices, availability, images
 * - Updates existing items
 * - Triggered by Cloud Scheduler or App Hosting cron
 */
export async function GET(request: NextRequest) {
  try {
    return await runAliExpressSync(request);
  } catch (error) {
    logger.error('Cron sync failed', { error });
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
