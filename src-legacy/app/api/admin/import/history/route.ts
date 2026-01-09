import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

/**
 * GET /api/admin/import/history - Lista wszystkich importów
 * Query params: ?limit=20&offset=0&status=completed
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // Optional filter

    console.log(`[Import History] Fetching jobs (limit: ${limit}, status: ${status || 'all'})`);

    let query = adminDb.collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (status) {
      query = query.where('status', '==', status) as any;
    }

    const snapshot = await query.get();
    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`[Import History] Found ${jobs.length} jobs`);

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
    });
  } catch (error: any) {
    console.error('[Import History] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
