import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * Moderation logs endpoint
 * GET /api/admin/moderation-logs
 * 
 * Query params:
 * - limit: number (default 100)
 * - targetType: 'deal' | 'product' | 'comment' | 'user' | 'report'
 * - moderatorId: string
 * - action: string
 * - startDate: ISO string
 * - endDate: ISO string
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Sprawdź czy użytkownik jest adminem
    const moderatorDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const moderatorData = moderatorDoc.data();
    const isAdmin = decodedToken.admin === true || moderatorData?.role === 'admin';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const targetType = searchParams.get('targetType');
    const moderatorId = searchParams.get('moderatorId');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    let query: any = adminDb.collection('moderation_log').orderBy('timestamp', 'desc');

    // Apply filters
    if (targetType) {
      query = query.where('targetType', '==', targetType);
    }

    if (moderatorId) {
      query = query.where('moderatorId', '==', moderatorId);
    }

    if (action) {
      query = query.where('action', '==', action);
    }

    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }

    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }

    query = query.limit(limit);

    const snapshot = await query.get();

    const logs = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get stats
    const stats = {
      total: logs.length,
      byAction: {} as Record<string, number>,
      byTargetType: {} as Record<string, number>,
      byModerator: {} as Record<string, number>,
    };

    logs.forEach((log: any) => {
      // Count by action
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

      // Count by target type
      if (log.targetType) {
        stats.byTargetType[log.targetType] = (stats.byTargetType[log.targetType] || 0) + 1;
      }

      // Count by moderator
      if (log.moderatorId) {
        stats.byModerator[log.moderatorId] = (stats.byModerator[log.moderatorId] || 0) + 1;
      }
    });

    return NextResponse.json({
      success: true,
      logs,
      stats,
      filters: {
        limit,
        targetType,
        moderatorId,
        action,
        startDate,
        endDate,
      },
    });
  } catch (error: any) {
    console.error('Get moderation logs error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get moderation logs' },
      { status: 500 }
    );
  }
}
