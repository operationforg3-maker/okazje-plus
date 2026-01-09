import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession, requireAdmin } from '@/lib/auth-server';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

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

    // Delete the job document using Firestore client SDK
    await deleteDoc(doc(db, 'harvester_jobs', jobId));

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
