import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { HarvesterJob } from '@/lib/types';

export const dynamic = 'force-dynamic';
const HARVESTER_STALE_MS = 15 * 60 * 1000;

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
    const jobId = searchParams.get('jobId');
    const statusFilter = searchParams.get('status');
    const limitParam = Math.min(100, parseInt(searchParams.get('limit') || '50'));

    // If jobId provided, fetch single job
    if (jobId) {
      const jobDoc = await adminDb.collection('harvester_jobs').doc(jobId).get();
      if (!jobDoc.exists) {
        return NextResponse.json(
          { success: false, error: 'Job not found' },
          { status: 404 }
        );
      }
      
      const job = { id: jobDoc.id, ...jobDoc.data() } as HarvesterJob;
      const lastUpdatedAtMs = Date.parse((job as any).lastUpdatedAt || '');
      const isStaleRunning =
        job.status === 'running' &&
        Number.isFinite(lastUpdatedAtMs) &&
        Date.now() - lastUpdatedAtMs > HARVESTER_STALE_MS;

      return NextResponse.json({
        success: true,
        job,
        diagnostics: {
          isStaleRunning,
          staleAfterMinutes: Math.round(HARVESTER_STALE_MS / 60000),
        },
      });
    }

    // 3. Build Firestore query (Admin SDK)
    let q: FirebaseFirestore.Query = adminDb.collection('harvester_jobs');
    const hasStatusFilter = statusFilter && ['running', 'completed', 'failed', 'paused'].includes(statusFilter);

    if (hasStatusFilter) {
      // With status filter: Query filtered results up to 200 documents, then sort in memory
      // to avoid requiring a composite index in Firestore for status + startedAt.
      q = q.where('status', '==', statusFilter).limit(200);
    } else {
      // Without status filter: Order by startedAt descending directly in Firestore
      // utilizing automatic single-field index.
      q = q.orderBy('startedAt', 'desc').limit(limitParam);
    }

    // 4. Execute query (Admin SDK)
    const snapshot = await q.get();
    const allDocs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    } as HarvesterJob));
    
    // Sort in-memory to guarantee descending chronological order
    const sortedJobs = allDocs.sort((a, b) => {
      const aTime = new Date(a.startedAt || 0).getTime();
      const bTime = new Date(b.startedAt || 0).getTime();
      return bTime - aTime;
    });

    // Slice to the requested limit size (important when statusFilter retrieved 200 docs)
    const jobs = hasStatusFilter ? sortedJobs.slice(0, limitParam) : sortedJobs;

    // 5. Return results
    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
    });
  } catch (error: any) {
    console.error('[Harvester Jobs API Error]', error);

    if (error.message?.includes('Unauthorized') || error.message?.includes('unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Unauthorized/Forbidden. Admin role required.' },
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
