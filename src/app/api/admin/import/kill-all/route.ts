/**
 * EMERGENCY: Kill All Import Jobs
 * POST /api/admin/import/kill-all
 * 
 * Immediately stops all running/queued/paused import jobs
 * Requires admin authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // Strict auth check - admin only
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[Kill All] Starting emergency kill all for user ${authResult.uid}`);

    // Get all active jobs from new system
    const newJobsSnap = await adminDb
      .collection('import_jobs')
      .where('status', 'in', ['queued', 'running', 'paused'])
      .get();

    console.log(`[Kill All] Found ${newJobsSnap.size} active jobs in import_jobs`);

    const killResults = {
      killed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Kill each job
    for (const jobDoc of newJobsSnap.docs) {
      try {
        const jobId = jobDoc.id;
        const jobData = jobDoc.data();

        await adminDb.collection('import_jobs').doc(jobId).update({
          status: 'failed',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          error: 'Emergency kill all executed by admin',
          killedBy: authResult.uid,
          killedAt: new Date().toISOString(),
        });

        console.log(`[Kill All] ✅ Killed job ${jobId}`);
        killResults.killed++;
      } catch (error: any) {
        const errorMsg = `Failed to kill job ${jobDoc.id}: ${error.message}`;
        console.error(`[Kill All] ❌ ${errorMsg}`);
        killResults.errors.push(errorMsg);
        killResults.skipped++;
      }
    }

    // Also try old system for completeness
    const oldJobsSnap = await adminDb
      .collection('importJobs')
      .where('status', 'in', ['pending', 'running'])
      .get();

    console.log(`[Kill All] Found ${oldJobsSnap.size} active jobs in importJobs (old system)`);

    for (const jobDoc of oldJobsSnap.docs) {
      try {
        const jobId = jobDoc.id;

        await adminDb.collection('importJobs').doc(jobId).update({
          status: 'cancelled',
          completedAt: new Date().toISOString(),
          cancelledAt: new Date().toISOString(),
          cancelledBy: authResult.uid,
        });

        console.log(`[Kill All] ✅ Killed old job ${jobId}`);
        killResults.killed++;
      } catch (error: any) {
        const errorMsg = `Failed to kill old job ${jobDoc.id}: ${error.message}`;
        console.error(`[Kill All] ❌ ${errorMsg}`);
        killResults.errors.push(errorMsg);
        killResults.skipped++;
      }
    }

    console.log(`[Kill All] Complete - Killed: ${killResults.killed}, Skipped: ${killResults.skipped}`);

    return NextResponse.json({
      success: true,
      message: `Emergency kill all executed. Killed: ${killResults.killed} jobs`,
      results: killResults,
      killedBy: authResult.uid,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Kill All] Fatal error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute kill all',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint - returns status of all import jobs
 * GET /api/admin/import/kill-all
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get active jobs
    const newJobsSnap = await adminDb
      .collection('import_jobs')
      .where('status', 'in', ['queued', 'running', 'paused'])
      .get();

    const oldJobsSnap = await adminDb
      .collection('importJobs')
      .where('status', 'in', ['pending', 'running'])
      .get();

    const activeJobs = [
      ...newJobsSnap.docs.map(doc => ({
        id: doc.id,
        system: 'new',
        status: doc.data().status,
        createdAt: doc.data().createdAt,
        type: doc.data().type,
      })),
      ...oldJobsSnap.docs.map(doc => ({
        id: doc.id,
        system: 'old',
        status: doc.data().status,
        createdAt: doc.data().createdAt,
      })),
    ];

    return NextResponse.json({
      activeJobCount: activeJobs.length,
      activeJobs,
      ready: activeJobs.length > 0,
      message: activeJobs.length > 0 
        ? `${activeJobs.length} active jobs - POST to /api/admin/import/kill-all to kill all`
        : 'No active jobs running',
    });
  } catch (error: any) {
    console.error('[Kill All GET] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
