import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { ImportQueueManager } from '@/lib/import-queue';

/**
 * POST /api/admin/import/queue
 * 
 * Create new background import job
 * Returns immediately with job ID for tracking
 */
export async function POST(req: NextRequest) {
  try {
    // Check admin authorization
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      sources = {},
      maxProductsPerCategory = 20,
      enableAdvancedFeatures = true,
      enableAIEnrichment = true,
      saveDraftsOnly = true,
    } = body;

    // Get enabled sources
    const enabledSources = Object.entries(sources)
      .filter(([_, enabled]) => enabled)
      .map(([source]) => source);

    if (enabledSources.length === 0) {
      return NextResponse.json(
        { error: 'No sources enabled' },
        { status: 400 }
      );
    }

    // Create job
    const jobId = await ImportQueueManager.createJob(
      enabledSources,
      {
        maxProductsPerCategory,
        enableAdvancedFeatures,
        enableAIEnrichment,
        saveDraftsOnly,
      },
      authResult.uid!
    );

    // Trigger Cloud Function to process job
    // Note: In production, this would be a Pub/Sub trigger or Cloud Tasks
    // For now, we'll process it in the background via separate endpoint
    
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Import job created. Use GET /api/admin/import/queue/{jobId} to track progress.',
    });
  } catch (error: any) {
    console.error('[POST /api/admin/import/queue] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create import job' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/import/queue?userId={uid}
 * 
 * List user's import jobs
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin authorization
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.uid!;
    const jobs = await ImportQueueManager.listUserJobs(userId);

    return NextResponse.json({
      success: true,
      jobs,
    });
  } catch (error: any) {
    console.error('[GET /api/admin/import/queue] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
