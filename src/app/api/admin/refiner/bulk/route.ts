import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-server';
import { AIRefiner } from '@/lib/automation/refiner';

/**
 * POST /api/admin/refiner/bulk
 * 
 * Bulk refine all products in database by status
 * Admin-only endpoint
 * 
 * Body:
 * {
 *   status?: string,           // Filter by status (e.g., 'draft', 'approved')
 *   limit?: number,            // Max products to refine (default 100)
 *   refinementType?: string    // 'full_enrichment' | 'specs_cleanup'
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Admin auth check
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - admin only' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      status,
      limit = 100,
      refinementType = 'full_enrichment',
    } = body;

    // Validate refinementType
    if (!['full_enrichment', 'specs_cleanup'].includes(refinementType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid refinementType. Must be full_enrichment or specs_cleanup' },
        { status: 400 }
      );
    }

    // Validate limit
    if (limit < 1 || limit > 1000) {
      return NextResponse.json(
        { success: false, error: 'Limit must be between 1 and 1000' },
        { status: 400 }
      );
    }

    console.log('[POST /api/admin/refiner/bulk] Starting bulk refinement:', {
      status,
      limit,
      refinementType,
      userId: session.uid,
    });

    // Create refiner jobs for both product_cores and deals
    const jobId = `refiner-bulk-${Date.now()}`;
    const refiner = new AIRefiner(jobId);

    const { DealRefiner } = await import('@/lib/automation/deal-refiner');
    const dealRefiner = new DealRefiner(`deal-${jobId}`);

    // Start refinement (non-blocking - jobs run in background)
    Promise.all([
      refiner.refineExistingProducts(
        status,
        limit,
        refinementType as 'full_enrichment' | 'specs_cleanup'
      ).catch(err => console.error('[BulkRefiner] product_cores error:', err)),
      dealRefiner.refineNewDeals(limit)
        .catch(err => console.error('[BulkRefiner] deals error:', err)),
    ]);

    // Return immediately with job ID
    return NextResponse.json({
      success: true,
      message: 'Bulk refinement started for both product_cores and deals',
      jobId,
      status: 'running',
      query: {
        status: status || 'all',
        limit,
        refinementType,
      },
    });

  } catch (error: any) {
    console.error('[POST /api/admin/refiner/bulk] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error starting bulk refinement',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/refiner/bulk?status=draft&limit=10
 * 
 * Preview: Count how many products and deals match the filter
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - admin only' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const { adminDb } = await import('@/lib/firebase-admin');
    const productsRef = adminDb.collection('product_cores');
    const dealsRef = adminDb.collection('deals');

    const pQuery = status ? productsRef.where('status', '==', status) : productsRef;
    const dQuery = status ? dealsRef.where('status', '==', status) : dealsRef;
    
    const [pSnap, dSnap] = await Promise.all([
      pQuery.count().get(),
      dQuery.count().get(),
    ]);

    const productCount = pSnap.data().count;
    const dealCount = dSnap.data().count;
    const totalCount = productCount + dealCount;

    return NextResponse.json({
      success: true,
      query: {
        status: status || 'all',
      },
      totalProducts: totalCount,
      productCoresCount: productCount,
      dealsCount: dealCount,
      message: `Found ${totalCount} items matching filter (${productCount} products, ${dealCount} deals)`,
    });

  } catch (error: any) {
    console.error('[GET /api/admin/refiner/bulk] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error counting products',
      },
      { status: 500 }
    );
  }
}
