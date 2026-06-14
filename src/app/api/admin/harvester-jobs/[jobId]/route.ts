import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';
import { HarvesterJob } from '@/lib/types';

const HARVESTER_STALE_MS = 15 * 60 * 1000;

/**
 * Get a specific harvester job from history with keep-awake polling
 * GET /api/admin/harvester-jobs/{jobId}
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    // Verify admin role
    await requireAdmin();

    const jobId = params.jobId;
    let jobDoc = await adminDb.collection('harvester_jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }
    
    let job = { id: jobDoc.id, ...jobDoc.data() } as HarvesterJob;

    // Under CPU-throttled Cloud Run, hold the connection open for up to 10 seconds
    // if the job is running. This keeps the container awake and allocates CPU cycles
    // to let the background harvester promise run to completion.
    if (job.status === 'running') {
      const checkIntervalMs = 2000;
      const maxWaitMs = 10000;
      let elapsed = 0;
      
      while (job.status === 'running' && elapsed < maxWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
        elapsed += checkIntervalMs;
        
        jobDoc = await adminDb.collection('harvester_jobs').doc(jobId).get();
        if (jobDoc.exists) {
          job = { id: jobDoc.id, ...jobDoc.data() } as HarvesterJob;
        } else {
          break;
        }
      }
    }

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
  } catch (error: any) {
    console.error('[GET /api/admin/harvester-jobs/[jobId]]', {
      jobId: params.jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Nie udało się pobrać zadania',
      },
      { status: 500 }
    );
  }
}

/**
 * Delete a specific harvester job from history
 * DELETE /api/admin/harvester-jobs/{jobId}
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    // Verify authentication
    const session = await getServerAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Nie jesteś zalogowany' },
        { status: 401 }
      );
    }

    // Verify admin role
    await requireAdmin();

    const jobId = params.jobId;

    // Delete the job document using Admin SDK (bypasses Firestore rules)
    await adminDb.collection('harvester_jobs').doc(jobId).delete();

    return NextResponse.json(
      {
        success: true,
        message: `Zadanie ${jobId} usunięte`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/admin/harvester-jobs/[jobId]]', {
      jobId: params.jobId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Nie udało się usunąć zadania',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Pause a specific harvester job
 * PATCH /api/admin/harvester-jobs/{jobId}
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Nie jesteś zalogowany' },
        { status: 401 }
      );
    }

    await requireAdmin();

    const jobId = params.jobId;
    const jobRef = adminDb.collection('harvester_jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json(
        { error: 'Nie znaleziono zadania' },
        { status: 404 }
      );
    }

    const jobData = jobSnap.data() as { status?: string; logs?: any[] };

    if (jobData.status !== 'running') {
      return NextResponse.json(
        { error: 'Zadanie nie jest aktywne' },
        { status: 400 }
      );
    }

    const logs = Array.isArray(jobData.logs) ? [...jobData.logs] : [];
    logs.push({
      level: 'warn',
      message: 'Zadanie zatrzymane ręcznie w panelu admina',
      timestamp: new Date().toISOString(),
    });

    await jobRef.update({
      status: 'paused',
      lastUpdatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      logs,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Zadanie ${jobId} zatrzymane`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error pausing harvester job:', error);
    return NextResponse.json(
      {
        error: 'Nie udało się zatrzymać zadania',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
