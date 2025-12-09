import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { ImportQueueManager } from '@/lib/import-queue';

interface RouteContext {
  params: {
    jobId: string;
  };
}

/**
 * GET /api/admin/import/queue/[jobId]
 * 
 * Get job status and progress
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
    const job = await ImportQueueManager.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user owns the job
    if (job.createdBy !== authResult.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
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
 * Cancel running job
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
    const job = await ImportQueueManager.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if user owns the job
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
    });
  } catch (error: any) {
    console.error('[DELETE /api/admin/import/queue/[jobId]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
