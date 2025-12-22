import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { refinePendingProducts } from '@/lib/automation/refiner';

/**
 * POST /api/admin/refiner/run
 * 
 * Uruchamia Refiner na pending_approval ProductCores
 * Body (optional): { limit?: number, dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authentication
    await requireAdmin();

    // 2. Parse request body (optional)
    const body = await request.json().catch(() => ({}));
    const { limit = 50, dryRun = false } = body;

    console.log('[Refiner API] Starting refiner', { limit, dryRun });

    // 3. Run refinement on pending_approval ProductCores
    const result = await refinePendingProducts();

    console.log('[Refiner API] Completed', result);

    // 4. Return results
    return NextResponse.json({
      success: true,
      job: result,
    });
  } catch (error: any) {
    console.error('[Refiner API Error]', error);

    if (error.message?.includes('Unauthorized') || error.message?.includes('unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin role required.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to run refiner',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
