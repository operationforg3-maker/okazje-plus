import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase-admin/firestore';
import { logger } from '@/lib/logging';

const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const cursor = searchParams.get('cursor');
    const pageSize = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 50 ? limitParam : DEFAULT_LIMIT;

    let baseQuery = query(
      collection(adminDb, 'importRuns'),
      orderBy('startedAt', 'desc'),
      limit(pageSize)
    );

    if (cursor) {
      baseQuery = query(baseQuery, startAfter(cursor));
    }

    const snapshot = await getDocs(baseQuery);
    const runs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    const nextCursor = snapshot.size === pageSize ? snapshot.docs[snapshot.size - 1]?.get('startedAt') : null;

    return NextResponse.json({ runs, nextCursor });
  } catch (error) {
    logger.error('Failed to list import runs', { error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
