import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { HarvesterJob } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/harvester-jobs
 * 
 * Pobiera listę ostatnich harvester jobów z Firestore
 * 
 * Query params:
 * - status: 'running' | 'completed' | 'failed' | 'paused' (optional filter)
 * - limit: number (default 50, max 100)
 * 
 * Response:
 * {
 *   success: boolean,
 *   jobs: HarvesterJob[],
 *   total: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verify admin authentication
    const session = await requireAdmin();

    // 2. Get query params
    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const limitParam = Math.min(100, parseInt(searchParams.get('limit') || '50'));

    // 3. Build Firestore query (Admin SDK)
    let q: FirebaseFirestore.Query = adminDb.collection('harvester_jobs');
    if (statusFilter && ['running', 'completed', 'failed', 'paused'].includes(statusFilter)) {
      q = q.where('status', '==', statusFilter);
    }
    q = q.limit(limitParam);

    // 4. Execute query (Admin SDK)
    const snapshot = await q.get();
    const allDocs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    } as HarvesterJob));
    
    // Sort in-memory (avoid Firestore composite index requirement)
    const jobs = allDocs.sort((a, b) => {
      const aTime = new Date(a.startedAt || 0).getTime();
      const bTime = new Date(b.startedAt || 0).getTime();
      return bTime - aTime;
    });

    // 5. Return results
    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
    });
  } catch (error: any) {
    console.error('[Harvester Jobs API Error]', error);

    if (error.message?.includes('Unauthorized') || error.message?.includes('unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin role required.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch harvester jobs',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
