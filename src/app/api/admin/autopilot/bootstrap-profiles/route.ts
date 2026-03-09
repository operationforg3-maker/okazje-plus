import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { logger } from '@/lib/logger';
import { ensureAliExpressImportProfilesCoverage } from '@/lib/import-profiles-bootstrap';

/**
 * POST /api/admin/autopilot/bootstrap-profiles
 * Tworzy brakujace profile importu AliExpress dla calego drzewa kategorii L3.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const dryRun = Boolean(body?.dryRun);
    const maxItemsPerRun =
      typeof body?.maxItemsPerRun === 'number' && Number.isFinite(body.maxItemsPerRun)
        ? Number(body.maxItemsPerRun)
        : undefined;

    const result = await ensureAliExpressImportProfilesCoverage({
      dryRun,
      maxItemsPerRun,
      createdBy: session.uid,
      enabled: true,
      defaultStatus: 'approved',
      deduplicationStrategy: 'skip',
    });

    logger.info('AliExpress profiles bootstrap completed', {
      dryRun,
      ...result,
      requestedBy: session.uid,
    });

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? 'Symulacja zakonczona. Profile nie zostaly zapisane.'
        : 'Bootstrap profili AliExpress zakonczony.',
      result,
    });
  } catch (error) {
    logger.error('AliExpress profiles bootstrap failed', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Bootstrap failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
