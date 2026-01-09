import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Reports management endpoint
 * GET /api/admin/reports - Get all reports
 * POST /api/admin/reports - Handle report action
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

    // Sprawdź czy użytkownik jest adminem lub moderatorem
    const moderatorDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const moderatorData = moderatorDoc.data();
    const isAdminOrMod =
      decodedToken.admin === true ||
      decodedToken.moderator === true ||
      moderatorData?.role === 'admin' ||
      moderatorData?.role === 'moderator';

    if (!isAdminOrMod) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const status = searchParams.get('status') || 'pending';
    const reportType = searchParams.get('type');

    // Build query
    let query = adminDb
      .collection('reports')
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (reportType && ['spam', 'duplicate', 'incorrect_info', 'offensive', 'expired', 'other'].includes(reportType)) {
      query = query.where('reportType', '==', reportType);
    }

    const snapshot = await query.get();

    // Enrich reports with target data
    const reports = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let targetData = null;

        // Fetch target document
        try {
          if (data.targetType && data.targetId) {
            let targetRef;
            if (data.targetType === 'deal') {
              targetRef = adminDb.collection('deals').doc(data.targetId);
            } else if (data.targetType === 'product') {
              targetRef = adminDb.collection('product_cores').doc(data.targetId);
            } else if (data.targetType === 'comment') {
              // Comments are subcollections, need parentId
              if (data.parentId && data.parentType) {
                const parentCol = data.parentType === 'deal' ? 'deals' : 'product_cores';
                targetRef = adminDb
                  .collection(parentCol)
                  .doc(data.parentId)
                  .collection('comments')
                  .doc(data.targetId);
              }
            } else if (data.targetType === 'user') {
              targetRef = adminDb.collection('users').doc(data.targetId);
            }

            if (targetRef) {
              const targetDoc = await targetRef.get();
              if (targetDoc.exists) {
                targetData = {
                  id: targetDoc.id,
                  ...targetDoc.data(),
                };
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch target data:', error);
        }

        return {
          id: doc.id,
          ...data,
          target: targetData,
        };
      })
    );

    return NextResponse.json({
      success: true,
      reports,
      total: reports.length,
    });
  } catch (error: any) {
    console.error('Get reports error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get reports' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Sprawdź czy użytkownik jest adminem lub moderatorem
    const moderatorDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const moderatorData = moderatorDoc.data();
    const isAdminOrMod =
      decodedToken.admin === true ||
      decodedToken.moderator === true ||
      moderatorData?.role === 'admin' ||
      moderatorData?.role === 'moderator';

    if (!isAdminOrMod) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { reportId, action, moderatorNotes } = body;

    // Walidacja
    if (!reportId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['approve', 'reject', 'delete-target', 'ignore'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const reportRef = adminDb.collection('reports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const reportData = reportDoc.data()!;
    const timestamp = new Date().toISOString();

    let updateData: Record<string, any> = {
      status: action === 'approve' || action === 'delete-target' ? 'resolved' : 'rejected',
      resolvedBy: decodedToken.uid,
      resolvedAt: timestamp,
      resolution: action,
      moderatorNotes: moderatorNotes || null,
      updatedAt: timestamp,
    };

    // Handle actions on reported content
    if (action === 'approve' || action === 'delete-target') {
      try {
        const { targetType, targetId, parentType, parentId } = reportData;

        if (action === 'delete-target' && targetType && targetId) {
          // Delete the reported content
          if (targetType === 'deal') {
            await adminDb.collection('deals').doc(targetId).update({
              status: 'deleted',
              deletedBy: decodedToken.uid,
              deletedAt: timestamp,
              deletionReason: 'Reported and confirmed',
            });
          } else if (targetType === 'product') {
            await adminDb.collection('product_cores').doc(targetId).update({
              status: 'deleted',
              deletedBy: decodedToken.uid,
              deletedAt: timestamp,
              deletionReason: 'Reported and confirmed',
            });
          } else if (targetType === 'comment' && parentId && parentType) {
            const parentCol = parentType === 'deal' ? 'deals' : 'product_cores';
            await adminDb
              .collection(parentCol)
              .doc(parentId)
              .collection('comments')
              .doc(targetId)
              .update({
                status: 'deleted',
                deletedBy: decodedToken.uid,
                deletedAt: timestamp,
                deletionReason: 'Reported and confirmed',
              });
          }

          // Award points to reporter if configured
          if (reportData.reportedBy) {
            await adminDb
              .collection('users')
              .doc(reportData.reportedBy)
              .update({
                reputation: FieldValue.increment(5),
                helpfulReportsCount: FieldValue.increment(1),
              });
          }
        }

        // Log moderation action
        await adminDb.collection('moderation_log').add({
          action: 'handle-report',
          reportId,
          reportType: reportData.reportType,
          resolution: action,
          targetType: reportData.targetType,
          targetId: reportData.targetId,
          moderatorId: decodedToken.uid,
          moderatorEmail: decodedToken.email || 'unknown',
          moderatorNotes,
          timestamp,
        });
      } catch (error) {
        console.error('Failed to handle reported content:', error);
        return NextResponse.json(
          { error: 'Failed to handle reported content' },
          { status: 500 }
        );
      }
    }

    // Update report
    await reportRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: `Report ${action}ed successfully`,
      reportId,
    });
  } catch (error: any) {
    console.error('Handle report error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to handle report' },
      { status: 500 }
    );
  }
}
