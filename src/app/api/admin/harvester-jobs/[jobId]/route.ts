import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

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
