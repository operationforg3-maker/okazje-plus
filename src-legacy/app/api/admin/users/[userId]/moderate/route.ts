import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * User moderation endpoint
 * POST /api/admin/users/[userId]/moderate
 * 
 * Body: {
 *   action: 'ban' | 'suspend' | 'unsuspend' | 'change-role' | 'warn',
 *   reason?: string,
 *   duration?: number (days for suspension),
 *   role?: 'user' | 'moderator' | 'admin'
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const { userId } = params;
    const body = await req.json();
    const { action, reason, duration, role } = body;

    // Walidacja
    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    const validActions = ['ban', 'suspend', 'unsuspend', 'change-role', 'warn'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Nie pozwalaj na moderację samego siebie
    if (userId === decodedToken.uid) {
      return NextResponse.json({ error: 'Cannot moderate yourself' }, { status: 400 });
    }

    // Nie pozwalaj na moderację innych adminów (tylko super-admin mógłby to robić)
    const targetUserDoc = await adminDb.collection('users').doc(userId).get();
    if (!targetUserDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUserData = targetUserDoc.data();
    if (targetUserData?.role === 'admin' && action === 'ban') {
      return NextResponse.json({ error: 'Cannot ban admin users' }, { status: 403 });
    }

    const timestamp = new Date().toISOString();
    let updateData: Record<string, any> = {
      updatedAt: timestamp,
    };

    // Prepare update based on action
    switch (action) {
      case 'ban':
        updateData.status = 'banned';
        updateData.bannedAt = timestamp;
        updateData.bannedBy = decodedToken.uid;
        if (reason) updateData.banReason = reason;
        // Disable Firebase Auth account
        try {
          await adminAuth.updateUser(userId, { disabled: true });
        } catch (error) {
          console.error('Failed to disable Firebase Auth:', error);
        }
        break;

      case 'suspend':
        if (!duration || duration <= 0) {
          return NextResponse.json({ error: 'Duration required for suspension' }, { status: 400 });
        }
        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + duration);
        updateData.status = 'suspended';
        updateData.suspendedAt = timestamp;
        updateData.suspendedBy = decodedToken.uid;
        updateData.suspendedUntil = suspendedUntil.toISOString();
        if (reason) updateData.suspensionReason = reason;
        break;

      case 'unsuspend':
        updateData.status = 'active';
        updateData.suspendedAt = null;
        updateData.suspendedBy = null;
        updateData.suspendedUntil = null;
        updateData.suspensionReason = null;
        // Re-enable Firebase Auth if was disabled
        try {
          const authUser = await adminAuth.getUser(userId);
          if (authUser.disabled) {
            await adminAuth.updateUser(userId, { disabled: false });
          }
        } catch (error) {
          console.error('Failed to enable Firebase Auth:', error);
        }
        break;

      case 'change-role':
        if (!role || !['user', 'moderator', 'admin'].includes(role)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        updateData.role = role;
        // Update custom claims
        try {
          const newClaims: Record<string, boolean> = {};
          if (role === 'admin') {
            newClaims.admin = true;
          } else if (role === 'moderator') {
            newClaims.moderator = true;
          }
          await adminAuth.setCustomUserClaims(userId, newClaims);
        } catch (error) {
          console.error('Failed to update custom claims:', error);
        }
        break;

      case 'warn':
        updateData.warnings = FieldValue.arrayUnion({
          issuedAt: timestamp,
          issuedBy: decodedToken.uid,
          reason: reason || 'No reason provided',
        });
        updateData.warningCount = FieldValue.increment(1);
        break;
    }

    // Apply update
    await adminDb.collection('users').doc(userId).update(updateData);

    // Log moderation action
    await adminDb.collection('moderation_log').add({
      action,
      targetType: 'user',
      targetId: userId,
      moderatorId: decodedToken.uid,
      moderatorEmail: decodedToken.email || 'unknown',
      reason: reason || null,
      duration,
      role,
      timestamp,
      metadata: {
        previousStatus: targetUserData?.status,
        previousRole: targetUserData?.role,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${action}ed successfully`,
      userId,
      action,
    });
  } catch (error: any) {
    console.error('User moderation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to moderate user' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/users/[userId]/moderate
 * Get moderation history for user
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const { userId } = params;

    // Get user data
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get moderation logs
    const logsSnapshot = await adminDb
      .collection('moderation_log')
      .where('targetType', '==', 'user')
      .where('targetId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const logs = logsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      user: {
        id: userDoc.id,
        ...userDoc.data(),
      },
      logs,
    });
  } catch (error: any) {
    console.error('Get moderation history error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get moderation history' },
      { status: 500 }
    );
  }
}
