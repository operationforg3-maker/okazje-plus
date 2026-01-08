import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Comment moderation endpoint
 * POST /api/admin/comments/moderate
 * 
 * Body: {
 *   action: 'approve' | 'reject' | 'delete' | 'mark-spam',
 *   commentId: string,
 *   parentType: 'deal' | 'product',
 *   parentId: string,
 *   reason?: string
 * }
 */
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
      return NextResponse.json({ error: 'Forbidden - admin or moderator role required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, commentId, parentType, parentId, reason } = body;

    // Walidacja
    if (!action || !commentId || !parentType || !parentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['approve', 'reject', 'delete', 'mark-spam'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!['deal', 'product'].includes(parentType)) {
      return NextResponse.json({ error: 'Invalid parentType' }, { status: 400 });
    }

    // M6: Określ kolekcję (product -> product_cores)
    const collectionName = parentType === 'deal' ? 'deals' : 'product_cores';
    const commentRef = adminDb
      .collection(collectionName)
      .doc(parentId)
      .collection('comments')
      .doc(commentId);

    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const timestamp = new Date().toISOString();
    let updateData: Record<string, any> = {
      updatedAt: timestamp,
    };

    switch (action) {
      case 'approve':
        updateData.status = 'approved';
        updateData.moderatedBy = decodedToken.uid;
        updateData.moderatedAt = timestamp;
        break;

      case 'reject':
        updateData.status = 'rejected';
        updateData.moderatedBy = decodedToken.uid;
        updateData.moderatedAt = timestamp;
        if (reason) updateData.rejectionReason = reason;
        break;

      case 'delete':
        updateData.status = 'deleted';
        updateData.deletedBy = decodedToken.uid;
        updateData.deletedAt = timestamp;
        if (reason) updateData.deletionReason = reason;
        break;

      case 'mark-spam':
        updateData.status = 'spam';
        updateData.markedAsSpamBy = decodedToken.uid;
        updateData.markedAsSpamAt = timestamp;
        // Decrease user reputation
        const commentData = commentDoc.data();
        if (commentData?.userId) {
          try {
            await adminDb
              .collection('users')
              .doc(commentData.userId)
              .update({
                reputation: FieldValue.increment(-10),
                spamCount: FieldValue.increment(1),
              });
          } catch (error) {
            console.error('Failed to update user reputation:', error);
          }
        }
        break;
    }

    // Apply update
    await commentRef.update(updateData);

    // Log moderation action
    await adminDb.collection('moderation_log').add({
      action,
      targetType: 'comment',
      targetId: commentId,
      parentType,
      parentId,
      moderatorId: decodedToken.uid,
      moderatorEmail: decodedToken.email || 'unknown',
      reason: reason || null,
      timestamp,
    });

    return NextResponse.json({
      success: true,
      message: `Comment ${action}ed successfully`,
      commentId,
    });
  } catch (error: any) {
    console.error('Comment moderation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to moderate comment' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/comments/moderate
 * Get comments requiring moderation (reported or flagged)
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') || 'pending';

    // Query reported comments from deals
    const dealCommentsQuery = adminDb.collectionGroup('comments')
      .where('reportCount', '>', 0)
      .orderBy('reportCount', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const snapshot = await dealCommentsQuery.get();
    
    const comments = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        // Get parent document path
        const parentRef = doc.ref.parent.parent;
        const parentDoc = await parentRef?.get();
        
        return {
          id: doc.id,
          ...data,
          parentId: parentRef?.id,
          parentType: parentRef?.parent.id === 'deals' ? 'deal' : 'product',
          parentTitle: parentDoc?.data()?.title || parentDoc?.data()?.name || 'Unknown',
        };
      })
    );

    return NextResponse.json({
      success: true,
      comments,
      total: comments.length,
    });
  } catch (error: any) {
    console.error('Get comments for moderation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get comments' },
      { status: 500 }
    );
  }
}
