import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { db } from '@/lib/firebase';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';

/**
 * GET /api/admin/refiner-logs
 * 
 * Pobiera live logs z ostatnio wykonanych refiner jobów
 * 
 * Query params:
 * - jobId: string (optional - get logs for specific job)
 * - limit: number (default 100, max 500)
 * 
 * Response:
 * {
 *   success: boolean,
 *   logs: Array<{
 *     jobId: string,
 *     productId?: string,
 *     status: 'success' | 'failed',
 *     message: string,
 *     timestamp: string
 *   }>,
 *   total: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await requireAdmin();

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const limitParam = Math.min(500, parseInt(searchParams.get('limit') || '100'));

    // Query refiner_jobs to get logs
    const jobsRef = collection(db, 'refiner_jobs');
    
    let q;
    if (jobId) {
      // Get logs from specific job
      q = query(
        jobsRef,
        where('id', '==', jobId),
        limit(1)
      );
    } else {
      // Get logs from most recent jobs
      q = query(
        jobsRef,
        orderBy('startedAt', 'desc'),
        limit(5) // Get last 5 jobs
      );
    }

    const snapshot = await getDocs(q);
    const logs: any[] = [];

    // Flatten logs from all matched jobs
    snapshot.docs.forEach(doc => {
      const job = doc.data();
      if (job.logs && Array.isArray(job.logs)) {
        job.logs.forEach((log: any) => {
          logs.push({
            jobId: doc.id,
            ...log,
          });
        });
      }
    });

    // Sort by timestamp and limit
    const sortedLogs = logs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limitParam);

    return NextResponse.json({
      success: true,
      logs: sortedLogs,
      total: sortedLogs.length,
    });
  } catch (error: any) {
    console.error('[Refiner Logs API Error]', error);

    if (error.message?.includes('Unauthorized') || error.message?.includes('unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin role required.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch refiner logs',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
