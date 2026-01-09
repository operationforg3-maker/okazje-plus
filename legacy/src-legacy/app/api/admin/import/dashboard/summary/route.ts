import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const auth = await checkAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [draftSnap, approvedSnap] = await Promise.all([
      adminDb.collection('products').where('status', '==', 'draft').limit(1_000).get(),
      adminDb.collection('products').where('status', '==', 'approved').limit(1_000).get(),
    ]);

    const jobsSnap = await adminDb
      .collection('import_jobs')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));

    return NextResponse.json({
      products: {
        draft: draftSnap.size,
        approved: approvedSnap.size,
      },
      recentJobs: jobs,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Summary failed' }, { status: 500 });
  }
}
