// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { doc, getDoc } from 'firebase-admin/firestore';
import { logger } from '@/lib/logging';

interface RouteContext {
  params: { id: string };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const authHeader = _req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth.verifyIdToken(token);
    
    // Verify admin access
    let userRecord;
    try {
      userRecord = await adminAuth.getUser(decoded.uid);
    } catch (error) {
      logger.error('Failed to get user record', { error });
      return NextResponse.json({ error: 'Failed to verify admin status' }, { status: 401 });
    }
    
    if (userRecord.customClaims?.['admin'] !== true) {
      return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
    }

    const runRef = doc(adminDb, 'importRuns', context.params.id);
    const snap = await getDoc(runRef);
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Import run not found' }, { status: 404 });
    }

    return NextResponse.json({ id: snap.id, ...snap.data() });
  } catch (error) {
    logger.error('Failed to fetch import run detail', { error, importRunId: context.params.id });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
