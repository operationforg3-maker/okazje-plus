import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { importFromAliExpress } from '@/lib/aliexpress-importer';
import { logger } from '@/lib/logger';

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

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const maxItemsOverride = typeof body?.maxItemsPerProfile === 'number'
      ? Number(body.maxItemsPerProfile)
      : undefined;
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

    const results: Array<{ profileId: string; name?: string; success: boolean; stats?: any; error?: string; }>
      = [];

    for (const profileDoc of profilesSnapshot.docs) {
      const profile = { id: profileDoc.id, ...profileDoc.data() } as any;

      try {
        logger.info('Autopilot: running profile', { profileId: profile.id, name: profile.name, maxItemsOverride });

        const result = await importFromAliExpress({
          profileId: profile.id,
          maxItems: maxItemsOverride || profile.maxItemsPerRun || 50,
          autoApprove,
          enableAI: true,
          triggeredBy: 'manual',
          triggeredByUid: session.uid,
        });

        results.push({ profileId: profile.id, name: profile.name, success: result.success, stats: result.stats });
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
