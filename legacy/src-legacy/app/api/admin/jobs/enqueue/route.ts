/**
 * POST /api/admin/jobs/enqueue
 * 
 * Enqueue a background job for the cron processor
 * Requires admin authorization
 * 
 * Supported job types:
 * - import_aliexpress: Product import from AliExpress
 * - import_allegro: Product import from Allegro  
 * - import_amazon: Product import from Amazon
 * - import_ebay: Product import from eBay
 * - verify_links: Validate affiliate URLs
 * - cleanup_products: Delete orphaned/invalid products
 * - repair_indexes: Rebuild Firestore/Typesense indexes
 */

import { NextRequest, NextResponse } from 'next/server';
import type { DocumentData, Query } from 'firebase-admin/firestore';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    // ===== AUTHORIZATION =====
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      type,
      payload,
    } = body;

    // ===== VALIDATION =====
    const validJobTypes = [
      'import_aliexpress',
      'import_allegro',
      'import_amazon',
      'import_ebay',
      'verify_links',
      'cleanup_products',
      'repair_indexes',
    ];

    if (!type || !validJobTypes.includes(type)) {
      return NextResponse.json(
        {
          error: 'Invalid job type',
          validTypes: validJobTypes,
        },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json(
        { error: 'Payload is required and must be an object' },
        { status: 400 }
      );
    }

    // Validate required fields for import jobs
    if (type.startsWith('import_')) {
      const requiredFields = ['mainCategory', 'subCategory', 'subSubCategory'];
      const missingFields = requiredFields.filter(field => !payload[field]);
      
      if (missingFields.length > 0) {
        return NextResponse.json(
          {
            error: 'Missing required fields for import job',
            missingFields,
          },
          { status: 400 }
        );
      }
    }

    // ===== CREATE JOB =====
    const jobRef = await adminDb.collection('jobs').add({
      type,
      status: 'pending',
      payload,
      createdAt: new Date(),
      createdBy: authResult.uid,
      retryCount: 0,
      maxRetries: 3,
    });

    logger.info('Job enqueued', {
      jobId: jobRef.id,
      type,
      createdBy: authResult.uid,
    });

    return NextResponse.json({
      success: true,
      jobId: jobRef.id,
      type,
      status: 'pending',
      message: `Job enqueued. Will be processed by next cron run.`,
    });
  } catch (error: any) {
    logger.error('Failed to enqueue job', {
      error: error.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        error: 'Failed to enqueue job',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/jobs/enqueue?limit=10&status=pending
 * 
 * List queued jobs (for monitoring)
 */
export async function GET(req: NextRequest) {
  try {
    // ===== AUTHORIZATION =====
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
    const status = req.nextUrl.searchParams.get('status') as string | null;

    // Build query
    let query: Query<DocumentData> = adminDb.collection('jobs');
    
    if (status) {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('createdAt', 'desc').limit(limit);

    const snapshot = await query.get();
    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      startedAt: doc.data().startedAt?.toDate?.() || doc.data().startedAt,
      completedAt: doc.data().completedAt?.toDate?.() || doc.data().completedAt,
    }));

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
    });
  } catch (error: any) {
    logger.error('Failed to list jobs', {
      error: error.message,
    });

    return NextResponse.json(
      {
        error: 'Failed to list jobs',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
