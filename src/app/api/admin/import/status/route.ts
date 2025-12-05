import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

/**
 * GET /api/admin/import/status?jobId=xxx - Pobierz status job
 * POST /api/admin/import/status - Zmień status (pause/resume)
 */

// Auth middleware
async function verifyAuth(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const userId = await verifyAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const jobRef = adminDb.collection('import_jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = jobSnap.data();
    return NextResponse.json({
      success: true,
      job: {
        id: jobId,
        ...jobData,
      },
    });
  } catch (error: any) {
    console.error('[Import Status GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const userId = await verifyAuth(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId, action } = await req.json();

    if (!jobId || !action) {
      return NextResponse.json({ error: 'Missing jobId or action' }, { status: 400 });
    }

    if (!['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use: pause, resume, cancel' }, { status: 400 });
    }

    const jobRef = adminDb.collection('import_jobs').doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = jobSnap.data();
    const currentStatus = jobData?.status;

    console.log(`[Import Status POST] Job ${jobId}: ${action} (current status: ${currentStatus})`);

    if (action === 'pause') {
      if (currentStatus !== 'running') {
        return NextResponse.json({ error: 'Can only pause running jobs' }, { status: 400 });
      }
      await jobRef.update({
        status: 'paused',
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, message: 'Job paused', status: 'paused' });
    }

    if (action === 'resume') {
      if (currentStatus !== 'paused') {
        return NextResponse.json({ error: 'Can only resume paused jobs' }, { status: 400 });
      }
      
      // Restart background processor from current position
      await jobRef.update({
        status: 'running',
        updatedAt: new Date().toISOString(),
      });

      // Re-trigger processor (it will read current progress and continue)
      const { processImportJob } = await import('../start/route');
      processImportJob(jobId, jobData.type, jobData.maxItemsPerSubcategory).catch((e) => {
        console.error(`[Import Status POST] Resume failed for job ${jobId}:`, e);
      });

      return NextResponse.json({ success: true, message: 'Job resumed', status: 'running' });
    }

    if (action === 'cancel') {
      await jobRef.update({
        status: 'cancelled',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, message: 'Job cancelled', status: 'cancelled' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Import Status POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
