import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, requireAdmin } from '@/lib/auth-server';
import { AIRefiner } from '@/lib/automation/refiner';

/**
 * POST /api/admin/refiner/run
 * 
 * Uruchamia AI Refiner do wzbogacania produktów
 * 
 * Request body:
 * {
 *   productIds: string[],
 *   refinationType: 'full_enrichment' | 'specs_cleanup'
 * }
 * 
 * Response:
 * {
 *   jobId: string,
 *   productsSuccessful: number,
 *   productsFailed: number,
 *   details: Record<productId, {status, message}>,
 *   logs: Array<{productId, status, message}>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin authentication
    const session = await getServerAuthSession();
    await requireAdmin(session);

    // 2. Parse request body
    const body = await request.json();
    const { productIds, refinationType } = body;

    // 3. Validate input
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!['full_enrichment', 'specs_cleanup'].includes(refinationType)) {
      return NextResponse.json(
        { error: 'Invalid refinationType. Must be full_enrichment or specs_cleanup' },
        { status: 400 }
      );
    }

    // 4. Create job ID and run refiner
    const jobId = `refine_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const refiner = new AIRefiner(jobId);

    // 5. Run refinement (returns RefinerJob result)
    const result = await refiner.refineProducts(
      productIds,
      refinationType as 'full_enrichment' | 'specs_cleanup'
    );

    // 6. Return results
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
