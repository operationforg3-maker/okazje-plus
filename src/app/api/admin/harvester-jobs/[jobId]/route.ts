import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase';

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

    // Delete the job document
    await adminDb.collection('harvester_jobs').doc(jobId).delete();

    return NextResponse.json(
      {
        success: true,
        message: `Zadanie ${jobId} usunięte`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting harvester job:', error);
    return NextResponse.json(
      {
        error: 'Nie udało się usunąć zadania',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
