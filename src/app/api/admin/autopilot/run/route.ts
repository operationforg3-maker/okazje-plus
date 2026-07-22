import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { SmartHarvester } from '@/lib/automation/harvester';
import { refreshProductPrices } from '@/lib/aliexpress-price-refresh';
import { logger } from '@/lib/logger';
import { isBackgroundProcessingEnabled } from '@/lib/system-settings';

const SETTINGS_DOC_PATH = 'admin_meta/aliexpress-autopilot-settings';

/**
 * POST /api/admin/autopilot/run
 * Admin-only helper to run all enabled AliExpress import profiles on demand.
 * Mirrors the cron behaviour but does not require CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const enabled = await isBackgroundProcessingEnabled('autopilotEnabled');
    if (!enabled) {
      return NextResponse.json({
        success: false,
        disabled: true,
        message: 'Autopilot jest obecnie wyłączony przez Master Switch procesów w tle.',
      });
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const maxItemsOverride = typeof body?.maxItemsPerProfile === 'number'
      ? Number(body.maxItemsPerProfile)
      : undefined;
    const importStrategy = body?.importStrategy === 'price_asc' ? 'price_asc' : 'bestsellers';
    const autoApproveOverride = typeof body?.autoApprove === 'boolean'
      ? body.autoApprove
      : undefined;

    const settingsSnap = await adminDb.doc(SETTINGS_DOC_PATH).get();
    const settings = settingsSnap.exists ? (settingsSnap.data() as { autoApprove?: boolean }) : {};
    const autoApprove = autoApproveOverride ?? settings.autoApprove ?? true;

    const profilesSnapshot = await adminDb
      .collection('importProfiles')
      .where('enabled', '==', true)
      .where('vendorId', '==', 'aliexpress')
      .get();

    if (profilesSnapshot.empty) {
      return NextResponse.json({ success: true, message: 'Brak aktywnych profili AliExpress', total: 0, results: [] });
    }

    // Odśwież ceny istniejących produktów przed nowym importem
    const refreshStats = await refreshProductPrices(50);
    logger.info('Autopilot: odświeżanie cen zakończone', refreshStats);

    const results: Array<{ profileId: string; name?: string; success: boolean; stats?: any; error?: string; }>
      = [];

    for (const profileDoc of profilesSnapshot.docs) {
      const profile = { id: profileDoc.id, ...profileDoc.data() } as any;
      const profileQuery = String(
        profile?.filters?.searchQuery || profile?.name || ''
      ).trim();

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
        const maxItems = maxItemsOverride || profile.maxItemsPerRun || 50;
        const jobId = `autopilot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const harvester = new SmartHarvester(jobId);

        logger.info('Autopilot: running profile via SmartHarvester', {
          profileId: profile.id,
          name: profile.name,
          query: profileQuery,
          maxItems,
          importStrategy,
          autoApprove,
        });

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
        results.push({
          profileId: profile.id,
          name: profile.name,
          success,
          stats: {
            productsFound: jobResult.productsFound,
            productsCreated: jobResult.productsCreated,
            dealsCreated: jobResult.dealsCreated,
            dealsLinked: jobResult.dealsLinked,
            duplicatesSkipped: jobResult.duplicatesSkipped,
            errors: jobResult.errors.length,
            status: jobResult.status,
            jobId: jobResult.id,
          },
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('Autopilot profile failed', { profileId: profile.id, error: msg });
        results.push({ profileId: profile.id, name: profile.name, success: false, error: msg });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: successCount === results.length,
      total: results.length,
      successful: successCount,
      failed: results.length - successCount,
      results,
      priceRefresh: refreshStats,
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

    logger.error('Autopilot run failed', { error });
    return NextResponse.json(
      {
        error: 'Autopilot failed',
        message,
      },
      { status: 500 }
    );
  }
}
