import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/moderation/logs
 * Query: limit=100, days=7, moderatorId=uid, action=approve|reject, targetType=deal|product
 *
 * Returns recent moderation_log entries sorted by timestamp desc.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, parseInt(searchParams.get('limit') || '100', 10));
    const days = parseInt(searchParams.get('days') || '7', 10);
    const moderatorId = searchParams.get('moderatorId');
    const action = searchParams.get('action');
    const targetType = searchParams.get('targetType');

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let q = adminDb
      .collection('moderation_log')
      .where('timestamp', '>=', since)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    const snap = await q.get();

    let logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<Record<string, unknown>>;

    // In-memory filters (Firestore compound query limits)
    if (moderatorId) logs = logs.filter(l => l.moderatorId === moderatorId);
    if (action) logs = logs.filter(l => l.action === action);
    if (targetType) logs = logs.filter(l => l.targetType === targetType);

    // Aggregate stats
    const stats = {
      total: logs.length,
      approved: logs.filter(l => l.action === 'approve').length,
      rejected: logs.filter(l => l.action === 'reject').length,
      deals: logs.filter(l => l.targetType === 'deal').length,
      products: logs.filter(l => l.targetType === 'product').length,
    };

    return NextResponse.json({ ok: true, logs, stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[moderation/logs] GET error:', err);
    if (message.includes('Unauthorized') || message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
