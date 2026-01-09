import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { startRefinerJob } from '@/lib/automation/refiner';
import { adminDb } from '@/lib/firebase-admin';

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

    // 3. Fetch pending_approval ProductCores
    let query = adminDb.collection('product_cores').where('status', '==', 'pending_approval');
    const snapshot = await query.limit(limit).get();
    const productIds = snapshot.docs.map(doc => doc.id);

    console.log(`[Refiner API] Found ${productIds.length} pending products`);

    if (productIds.length === 0) {
      return NextResponse.json({
        success: true,
        job: {
          id: `refine_${Date.now()}`,
          status: 'skipped',
          message: 'No pending_approval products to refine',
          productsFound: 0,
          productsEnriched: 0,
          errors: [],
        },
      });
    }

    // 4. Run refinement
    const result = await startRefinerJob(productIds, 'full_enrichment');

    console.log('[Refiner API] Completed', result);

  // 5. Return results
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
