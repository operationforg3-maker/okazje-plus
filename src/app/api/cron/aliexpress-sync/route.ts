import { NextRequest, NextResponse } from 'next/server';
import { SmartHarvester } from '@/lib/automation/harvester';
import { getAliExpressClient } from '@/lib/integrations/aliexpress-client';
import { ensureAliExpressImportProfilesCoverage } from '@/lib/import-profiles-bootstrap';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { isBackgroundProcessingEnabled } from '@/lib/system-settings';

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

    const runStartedAt = Date.now();
    const settingsSnap = await adminDb.doc(SETTINGS_DOC_PATH).get();
    const settings = settingsSnap.exists ? (settingsSnap.data() as any) : {};
    const stateRef = adminDb.doc(STATE_DOC_PATH);
    const stateSnap = await stateRef.get();
    const state = stateSnap.exists ? (stateSnap.data() as any) : {};
    const runTelemetry = {
      ensureProfilesMs: 0,
      loadProfilesMs: 0,
      profileProcessingMs: 0,
      totalMs: 0,
      profiles: [] as Array<{
        profileId: string;
        name?: string;
        query: string;
        status: 'completed' | 'failed';
        durationMs: number;
        jobId?: string;
        harvesterTelemetry?: unknown;
        error?: string;
      }>,
    };

    if (settings?.enabled === false) {
      logger.info('AliExpress sync skipped: autopilot disabled in settings');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Autopilot AliExpress jest wyłączony w ustawieniach.',
      });
    }

    // Check if imports are globally paused via System Master Switch or config
    const isMasterEnabled = await isBackgroundProcessingEnabled('autopilotEnabled');
    if (!isMasterEnabled) {
      logger.info('AliExpress sync skipped: disabled by System Master Switch');
      return NextResponse.json({
        success: true,
        skipped: true,
        disabled: true,
        message: 'Autopilot AliExpress jest wyłączony przez Master Switch.',
      });
    }

    let isPaused = false;
    try {
      const configDoc = await adminDb.collection('config').doc('importSettings').get();
      if (configDoc.exists) {
        isPaused = !!configDoc.data()?.isPaused;
      }
    } catch (_) {}

    if (isPaused) {
      logger.info('AliExpress sync skipped: globally paused in importSettings');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Autopilot AliExpress jest zatrzymany (globalna pauza).',
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
      const ensureProfilesStartedAt = Date.now();
      const bootstrapResult = await ensureAliExpressImportProfilesCoverage({
        enabled: true,
        defaultStatus: 'approved',
        deduplicationStrategy: 'skip',
        maxItemsPerRun: maxItems,
        createdBy: 'cron',
      });
      runTelemetry.ensureProfilesMs += Date.now() - ensureProfilesStartedAt;

      logger.info('AliExpress profile coverage ensured', bootstrapResult);
      await stateRef.set(
        {
          lastEnsuredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    const loadProfilesStartedAt = Date.now();
    const profilesSnapshot = await adminDb
      .collection('importProfiles')
      .where('enabled', '==', true)
      .where('vendorId', '==', 'aliexpress')
      .get();
    runTelemetry.loadProfilesMs += Date.now() - loadProfilesStartedAt;

    // ─── Phase A: Super Deals Stream ────────
    const superDealsEnabled = settings?.superDealsEnabled === true;
    const superDealsMaxPromos = Number(settings?.superDealsMaxPromos ?? 0);
    
    let superDealsResult: any = null;
    
    if (superDealsEnabled && superDealsMaxPromos > 0) {
      const superDealsStartedAt = Date.now();
      logger.info('Phase A: Starting AliExpress Super Deals', { superDealsMaxPromos });
      try {
        const client = getAliExpressClient();
        const promosResponse = await client.getFeaturedPromos();
        const promos = promosResponse?.resp_result?.result?.promos?.promo || [];
        
        let totalProcessed = 0;
        if (promos.length > 0) {
          const topPromos = promos.slice(0, superDealsMaxPromos);
          const harvester = new SmartHarvester(`cron_superdeals_${Date.now()}`);
          
          for (const promo of topPromos) {
            const promoName = promo.promo_name;
            logger.info(`Phase A: Harvesting Super Deals for campaign: ${promoName}`);
            const job = await harvester.harvestProducts('campaigns', promoName, 20);
            totalProcessed += ((job.telemetry as any)?.totalMatched || 0);
          }
        }
        
        superDealsResult = {
          success: true,
          promosProcessed: promos.length > 0 ? Math.min(promos.length, superDealsMaxPromos) : 0,
          totalProducts: totalProcessed,
          durationMs: Date.now() - superDealsStartedAt
        };
      } catch (err: any) {
        logger.error('Phase A: Super Deals failed', { error: err.message });
        superDealsResult = {
          success: false,
          error: err.message,
          durationMs: Date.now() - superDealsStartedAt
        };
      }
    }
    // ────────────────────────────────────────

    if (profilesSnapshot.empty && !superDealsEnabled && !settings?.hotStreamEnabled) {
      logger.info('No enabled AliExpress import profiles and other streams disabled');
      return NextResponse.json({
        success: true,
        message: 'No profiles or streams to sync',
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
      const profileStartedAt = Date.now();
      const profile = { id: profileDoc.id, ...profileDoc.data() } as { id: string; name?: string; [key: string]: unknown };
      const profileQuery = String((profile as any)?.filters?.searchQuery || profile.name || '').trim();

      if (!profileQuery) {
        const durationMs = Date.now() - profileStartedAt;
        runTelemetry.profileProcessingMs += durationMs;
        runTelemetry.profiles.push({
          profileId: profile.id,
          name: profile.name,
          query: profileQuery,
          status: 'failed',
          durationMs,
          error: 'Profil nie ma searchQuery ani nazwy do użycia jako zapytanie.',
        });

        results.push({
          profileId: profile.id,
          name: profile.name,
          success: false,
          error: 'Profil nie ma searchQuery ani nazwy do użycia jako zapytanie.',
          durationMs,
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
        const durationMs = Date.now() - profileStartedAt;
        runTelemetry.profileProcessingMs += durationMs;
        const stats = {
          productsFound: jobResult.productsFound,
          productsCreated: jobResult.productsCreated,
          dealsCreated: jobResult.dealsCreated,
          dealsLinked: jobResult.dealsLinked,
          duplicatesSkipped: jobResult.duplicatesSkipped,
          errors: jobResult.errors.length,
          status: jobResult.status,
          jobId: jobResult.id,
          durationMs,
        };

        runTelemetry.profiles.push({
          profileId: profile.id,
          name: profile.name,
          query: profileQuery,
          status: success ? 'completed' : 'failed',
          durationMs,
          jobId: jobResult.id,
          harvesterTelemetry: jobResult.telemetry,
          error: success ? undefined : `Harvester status: ${jobResult.status}`,
        });

        results.push({
          profileId: profile.id,
          name: profile.name,
          success,
          stats,
          telemetry: jobResult.telemetry,
        });

        logger.info('Profile sync completed', {
          profileId: profile.id,
          stats,
        });
      } catch (error) {
        const durationMs = Date.now() - profileStartedAt;
        runTelemetry.profileProcessingMs += durationMs;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error('Profile sync failed', {
          profileId: profile.id,
          error: errorMessage,
          durationMs,
        });

        runTelemetry.profiles.push({
          profileId: profile.id,
          name: profile.name,
          query: profileQuery,
          status: 'failed',
          durationMs,
          error: errorMessage,
        });

        results.push({
          profileId: profile.id,
          name: profile.name,
          success: false,
          error: errorMessage,
          durationMs,
        });
      }
    }

    // ─── Phase B: Hot Stream (globalny + per AliExpress category IDs) ────────
    // Runs after keyword search profiles. Uses aliexpress.affiliate.hotproduct.query
    // (no keyword needed) — AI then assigns each product to the correct site category.
    const hotStreamEnabled = settings?.hotStreamEnabled === true;
    const hotStreamGlobalLimit = Number(settings?.hotStreamGlobalLimit ?? 0);
    const hotStreamPerCategoryLimit = Number(settings?.hotStreamPerCategoryLimit ?? 0);
    const hotStreamLimit = Math.max(hotStreamGlobalLimit, hotStreamPerCategoryLimit, 0);

    let hotStreamResult: {
      success: boolean;
      productsCreated: number;
      dealsCreated: number;
      durationMs: number;
      error?: string;
    } | null = null;

    if (hotStreamEnabled && hotStreamLimit > 0) {
      const hotStreamStartedAt = Date.now();
      logger.info('Phase B: Starting AliExpress hot stream', {
        hotStreamGlobalLimit,
        hotStreamPerCategoryLimit,
        hotStreamLimit,
      });

      try {
        const hotJobId = `cron_hotstream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const hotHarvester = new SmartHarvester(hotJobId);

        // autoBrowse=true → fetchFromAliExpressAutoBrowse:
        //   1. getHotProducts(categoryChunks) per all AliExpress category IDs from Firestore
        //   2. getHotProducts(undefined) as global fallback
        //   → AI batchAssignCategories assigns each product to site category tree
        const hotJob = await hotHarvester.harvestProducts(
          'aliexpress',
          '__AUTO_BROWSE__',
          hotStreamLimit,
          undefined,
          false,
          undefined,
          true,         // autoBrowse = true
          importStrategy
        );

        const hotDurationMs = Date.now() - hotStreamStartedAt;
        hotStreamResult = {
          success: hotJob.status === 'completed',
          productsCreated: hotJob.productsCreated,
          dealsCreated: hotJob.dealsCreated,
          durationMs: hotDurationMs,
          error: hotJob.status !== 'completed' ? `Harvester status: ${hotJob.status}` : undefined,
        };

        logger.info('Phase B: Hot stream completed', {
          status: hotJob.status,
          productsCreated: hotJob.productsCreated,
          dealsCreated: hotJob.dealsCreated,
          durationMs: hotDurationMs,
        });
      } catch (hotErr) {
        const hotDurationMs = Date.now() - hotStreamStartedAt;
        const hotErrMsg = hotErr instanceof Error ? hotErr.message : String(hotErr);
        logger.error('Phase B: Hot stream failed', { error: hotErrMsg, durationMs: hotDurationMs });
        hotStreamResult = {
          success: false,
          productsCreated: 0,
          dealsCreated: 0,
          durationMs: hotDurationMs,
          error: hotErrMsg,
        };
      }
    }
    // ─────────────────────────────────────────────────────────────────────────


    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    runTelemetry.totalMs = Date.now() - runStartedAt;

    logger.info('Scheduled AliExpress sync completed', {
      total: totalCount,
      availableProfiles: orderedProfileDocs.length,
      successful: successCount,
      failed: totalCount - successCount,
      nextProfileCursor,
      telemetry: {
        ensureProfilesMs: runTelemetry.ensureProfilesMs,
        loadProfilesMs: runTelemetry.loadProfilesMs,
        profileProcessingMs: runTelemetry.profileProcessingMs,
        totalMs: runTelemetry.totalMs,
      },
    });

    await stateRef.set(
      {
        lastProfileCursor: nextProfileCursor,
        lastBatchAt: new Date().toISOString(),
        lastBatchSize: selectedProfileDocs.length,
        maxProfilesPerRun,
        lastRunTelemetry: {
          ensureProfilesMs: runTelemetry.ensureProfilesMs,
          loadProfilesMs: runTelemetry.loadProfilesMs,
          profileProcessingMs: runTelemetry.profileProcessingMs,
          totalMs: runTelemetry.totalMs,
          processedProfiles: selectedProfileDocs.length,
          availableProfiles: orderedProfileDocs.length,
          superDeals: superDealsResult ?? undefined,
          hotStream: hotStreamResult ?? undefined,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const slowestProfiles = [...runTelemetry.profiles]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 5)
      .map((entry) => ({
        profileId: entry.profileId,
        name: entry.name,
        query: entry.query,
        durationMs: entry.durationMs,
        status: entry.status,
      }));

    return NextResponse.json({
      success: true,
      synced: successCount,
      total: totalCount,
      availableProfiles: orderedProfileDocs.length,
      processedProfiles: selectedProfileDocs.length,
      nextProfileCursor,
      superDeals: superDealsResult,
      hotStream: hotStreamResult,
      telemetry: {
        ensureProfilesMs: runTelemetry.ensureProfilesMs,
        loadProfilesMs: runTelemetry.loadProfilesMs,
        profileProcessingMs: runTelemetry.profileProcessingMs,
        totalMs: runTelemetry.totalMs,
        slowestProfiles,
      },
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
