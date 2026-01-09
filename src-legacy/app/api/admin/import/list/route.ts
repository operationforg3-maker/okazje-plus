/**
 * LIST IMPORT JOBS - with filtering and sorting
 * GET /api/admin/import/list?status=running&sortBy=createdAt&order=desc&limit=50
 * 
 * Query params:
 * - status: queued|running|paused|completed|failed|cancelled|pending (optional)
 * - sortBy: createdAt|updatedAt|status|type (default: createdAt)
 * - order: asc|desc (default: desc)
 * - limit: number (default: 50, max: 1000)
 * - system: new|old|both (default: both)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

interface ImportJob {
  id: string;
  system: 'new' | 'old';
  status: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  sources?: string[];
  processedBatches?: number;
  totalBatches?: number;
  error?: string;
  killedBy?: string;
  killedAt?: string;
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await checkAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = searchParams.get('order') || 'desc';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 1000);
    const system = searchParams.get('system') || 'both';

    // Fetch from both systems
    const allJobs: ImportJob[] = [];

    // New system (import_jobs)
    if (system === 'new' || system === 'both') {
      let query: any = adminDb.collection('import_jobs');

      if (status) {
        query = query.where('status', '==', status);
      }

      const newSnapshot = await query.get();

      newSnapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        allJobs.push({
          id: doc.id,
          system: 'new',
          status: doc.data().status,
          type: doc.data().type,
          createdAt: doc.data().createdAt,
          updatedAt: doc.data().updatedAt,
          sources: doc.data().sources,
          processedBatches: doc.data().processedBatches,
          totalBatches: doc.data().totalBatches,
          error: doc.data().error,
          killedBy: doc.data().killedBy,
          killedAt: doc.data().killedAt,
        });
      });
    }

    // Old system (importJobs)
    if (system === 'old' || system === 'both') {
      let query: any = adminDb.collection('importJobs');

      if (status) {
        query = query.where('status', '==', status);
      }

      const oldSnapshot = await query.get();

      oldSnapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        allJobs.push({
          id: doc.id,
          system: 'old',
          status: doc.data().status,
          type: doc.data().type,
          createdAt: doc.data().createdAt,
          updatedAt: doc.data().updatedAt,
          error: doc.data().error,
          killedBy: doc.data().cancelledBy,
          killedAt: doc.data().cancelledAt,
        });
      });
    }

    // Sort
    const sortFn = (a: ImportJob, b: ImportJob) => {
      let aVal: any = a[sortBy as keyof ImportJob];
      let bVal: any = b[sortBy as keyof ImportJob];

      if (!aVal) aVal = '';
      if (!bVal) bVal = '';

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }

      return order === 'desc' ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
    };

    allJobs.sort(sortFn);

    // Apply limit
    const paginatedJobs = allJobs.slice(0, limit);

    return NextResponse.json({
      success: true,
      total: allJobs.length,
      returned: paginatedJobs.length,
      query: {
        status: status || 'all',
        sortBy,
        order,
        limit,
        system,
      },
      jobs: paginatedJobs,
    });
  } catch (error: any) {
    console.error('[Import List] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch import jobs',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
