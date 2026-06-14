import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { RefinerJob } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/refiner-jobs
 * 
 * Pobiera listę ostatnich refiner jobów z Firestore
 * 
 * Query params:
 * - status: 'running' | 'completed' | 'failed' | 'paused' (optional filter)
 * - limit: number (default 50, max 100)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const searchParams = request.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const limitParam = Math.min(100, parseInt(searchParams.get('limit') || '50'));

    let q: FirebaseFirestore.Query = adminDb.collection('refiner_jobs');
    if (statusFilter && ['running', 'completed', 'failed', 'paused'].includes(statusFilter)) {
      q = q.where('status', '==', statusFilter);
    }
    q = q.limit(limitParam);

    const snapshot = await q.get();
    let allDocs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    } as RefinerJob));
    
    // Under CPU-throttled Cloud Run, hold the connection open if any job is running.
    // This keeps the container awake so background refiner promises can execute.
    let runningJob = allDocs.find((j) => j.status === 'running');
    if (runningJob) {
      const checkIntervalMs = 2000;
      const maxWaitMs = 10000;
      let elapsed = 0;
      
      while (runningJob && elapsed < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
        elapsed += checkIntervalMs;
        
        const freshSnapshot = await q.get();
        allDocs = freshSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        } as RefinerJob));
        
        runningJob = allDocs.find((j) => j.status === 'running');
      }
    }

    // Sort in-memory
    const jobs = allDocs.sort((a, b) => {
      const aTime = new Date(a.startedAt || 0).getTime();
      const bTime = new Date(b.startedAt || 0).getTime();
      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length // This is just the fetched count, not total in DB
    });

  } catch (error: any) {
    console.error('[API] Error listing refiner jobs:', error);
    
    if (error.message?.includes('Unauthorized') || error.message?.includes('unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Unauthorized/Forbidden. Admin role required.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
