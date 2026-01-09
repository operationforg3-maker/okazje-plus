import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Stop all running harvester jobs
 * POST /api/admin/harvester/kill-all
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const session = await requireAdmin();

    // Find all running harvester jobs
    const jobsRef = adminDb.collection('harvester_jobs');
    const runningSnapshot = await jobsRef
      .where('status', '==', 'running')
      .get();

    const killed = [];

    // Update each running job to 'paused' status
    for (const doc of runningSnapshot.docs) {
      const logs = (doc.data().logs || []) as any[];
      logs.push({
        level: 'warn',
        message: 'Zadanie zatrzymane przez administratora',
        timestamp: new Date().toISOString(),
      });

      await doc.ref.update({
        status: 'paused',
        lastUpdatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        logs,
      });
      killed.push(doc.id);
    }

    return NextResponse.json(
      {
        success: true,
        killed: killed.length,
        jobIds: killed,
        message: `Zatrzymano ${killed.length} zadań harvestera`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in kill-all harvester:', error);
    return NextResponse.json(
      {
        error: 'Nie udało się zatrzymać zadań',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
