/**
 * Admin Ingestion API Endpoints
 * POST /api/admin/ingestion/trigger - Start import job
 * GET  /api/admin/ingestion/status/:jobId - Get job status
 * POST /api/admin/ingestion/pause/:jobId - Pause job
 * POST /api/admin/ingestion/resume/:jobId - Resume job
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { getJobQueue } from "@/lib/ingestion/queue";
import { executePipeline, PipelineConfig } from "@/lib/ingestion/pipeline";

// ===== Auth middleware =====
async function checkAdminAuth(req: NextRequest): Promise<{ uid: string } | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return null;
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    // TODO: Check admin role in Firestore
    return { uid: decodedToken.uid };
  } catch (error) {
    logger.warn("Auth check failed", { error });
    return null;
  }
}

// ===== POST /api/admin/ingestion/trigger =====
export async function POST(req: NextRequest) {
  try {
    const user = await checkAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const config: PipelineConfig = body.config;

    if (!config.source || !config.categoryPath) {
      return NextResponse.json(
        { error: "Missing required fields: source, categoryPath" },
        { status: 400 }
      );
    }

    // Enqueue job
    const queue = getJobQueue();
    const jobId = await queue.enqueue("import_pipeline", config, {
      invokedBy: user.uid,
      metadata: { triggerTime: new Date().toISOString() },
    });

    logger.info("Import job triggered", { jobId, source: config.source, user: user.uid });

    // Optionally start processing immediately (in production, use Cloud Tasks)
    if (body.executeNow) {
      setImmediate(() => {
        executePipeline(jobId, config).catch((error) => {
          logger.error("Pipeline execution failed", { jobId, error });
        });
      });
    }

    return NextResponse.json({
      jobId,
      status: "pending",
      message: "Import job enqueued",
    });
  } catch (error) {
    logger.error("POST /api/admin/ingestion/trigger failed", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ===== GET /api/admin/ingestion/status/[jobId] =====
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId?: string } }
) {
  try {
    const user = await checkAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobId = params?.jobId || req.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    const queue = getJobQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      result: job.result,
      error: job.error,
    });
  } catch (error) {
    logger.error("GET /api/admin/ingestion/status failed", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ===== POST /api/admin/ingestion/pause/[jobId] =====
export async function pauseJob(
  req: NextRequest,
  { params }: { params: { jobId?: string } }
) {
  try {
    const user = await checkAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobId = params?.jobId || req.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    const queue = getJobQueue();
    await queue.pauseJob(jobId);

    logger.info("Job paused", { jobId, user: user.uid });

    return NextResponse.json({
      message: "Job paused",
      jobId,
      status: "paused",
    });
  } catch (error) {
    logger.error("POST /api/admin/ingestion/pause failed", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ===== POST /api/admin/ingestion/resume/[jobId] =====
export async function resumeJob(
  req: NextRequest,
  { params }: { params: { jobId?: string } }
) {
  try {
    const user = await checkAdminAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobId = params?.jobId || req.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    const queue = getJobQueue();
    await queue.resumeJob(jobId);

    logger.info("Job resumed", { jobId, user: user.uid });

    return NextResponse.json({
      message: "Job resumed",
      jobId,
      status: "pending",
    });
  } catch (error) {
    logger.error("POST /api/admin/ingestion/resume failed", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
