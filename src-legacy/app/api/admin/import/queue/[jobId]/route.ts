import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';
import { ImportQueueManager } from '@/lib/import-queue';

interface RouteContext {
  params: {
    jobId: string;
  };
}

/**
 * GET /api/admin/import/queue/[jobId]
 * 
 * Get job status and progress (supports both old and new import systems)
 */
export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    // Check admin authorization
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { jobId } = context.params;

    // Try new import_jobs collection first (new system)
    const newJobDoc = await adminDb.collection('import_jobs').doc(jobId).get();
    if (newJobDoc.exists) {
      const jobData = newJobDoc.data();
      return NextResponse.json({
        success: true,
        job: {
          id: jobId,
          ...jobData,
          system: 'new', // Mark which system
        },
      });
    }

    // Fall back to old ImportQueueManager system
    const job = await ImportQueueManager.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user owns the job (old system only)
    if (job.createdBy !== authResult.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        ...job,
        system: 'old', // Mark which system
      },
    });
  } catch (error: any) {
    console.error('[GET /api/admin/import/queue/[jobId]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/import/queue/[jobId]
 * 
 * Cancel running job (supports both old and new import systems)
 */
export async function DELETE(
  req: NextRequest,
  context: RouteContext
) {
  try {
    // Check admin authorization
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { jobId } = context.params;

    // Try new import_jobs collection first (new system)
    const newJobDoc = await adminDb.collection('import_jobs').doc(jobId).get();
    if (newJobDoc.exists) {
      const jobData = newJobDoc.data();
      
      // Only cancel if running, queued, or paused
      if (['running', 'queued', 'paused'].includes(jobData?.status)) {
        await adminDb.collection('import_jobs').doc(jobId).update({
          status: 'failed',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          error: 'Job cancelled by user',
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Job cancelled',
        jobId,
      });
    }

    // Fall back to old ImportQueueManager system
    const job = await ImportQueueManager.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user owns the job (old system only)
    if (job.createdBy !== authResult.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Only cancel if running or pending
    if (job.status === 'running' || job.status === 'pending') {
      await ImportQueueManager.cancelJob(jobId, authResult.uid!);
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled',
      jobId,
    });
  } catch (error: any) {
    console.error('[DELETE /api/admin/import/queue/[jobId]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
