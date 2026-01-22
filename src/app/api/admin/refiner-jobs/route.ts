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
    const allDocs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    } as RefinerJob));
    
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

  } catch (error) {
    console.error('[API] Error listing refiner jobs:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
