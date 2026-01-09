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

    // Create refiner job
    const jobId = `refiner-bulk-${Date.now()}`;
    const refiner = new AIRefiner(jobId);

    // Start refinement (non-blocking - job runs in background)
    const jobPromise = refiner.refineExistingProducts(
      status,
      limit,
      refinementType as 'full_enrichment' | 'specs_cleanup'
    );

    // Return immediately with job ID
    // Client can poll /api/admin/refiner-logs/{jobId} for progress
    return NextResponse.json({
      success: true,
      message: 'Bulk refinement started',
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
 * Preview: Count how many products match the filter
 * Doesn't actually refine anything
 */
export async function GET(req: NextRequest) {
  try {
    // Admin auth check
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - admin only' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    // Import Firebase Admin to count products
    const { adminDb } = await import('@/lib/firebase-admin');
    const productsRef = adminDb.collection('product_cores');
    const query = status ? productsRef.where('status', '==', status) : productsRef;
    
    const snapshot = await query.count().get();
    const totalCount = snapshot.data().count;

    return NextResponse.json({
      success: true,
      query: {
        status: status || 'all',
      },
      totalProducts: totalCount,
      message: `Found ${totalCount} products matching filter`,
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
