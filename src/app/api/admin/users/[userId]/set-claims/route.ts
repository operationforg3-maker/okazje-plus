import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';

/**
 * POST /api/admin/users/[userId]/set-claims
 *
 * Sets Firebase custom claims to match the user's Firestore role.
 * This ensures the client-side auth context (AdminAuthGuard) can resolve
 * roles instantly from the JWT without waiting for a Firestore round-trip.
 *
 * Call this endpoint whenever a user's role is changed in the admin panel.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { userId } = params;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const { adminDb, adminAuth } = await import('@/lib/firebase-admin');

    // Fetch current role from Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const role = userData?.role as string | undefined;

    if (!role) {
      return NextResponse.json({ success: false, error: 'User has no role set' }, { status: 400 });
    }

    // Build claims object
    const claims: Record<string, unknown> = { role };
    if (role === 'admin') claims.admin = true;
    if (role === 'moderator') claims.moderator = true;

    // Set custom claims on Firebase Auth
    await adminAuth.setCustomUserClaims(userId, claims);

    console.log(`[set-claims] Set claims for ${userId}:`, claims);

    return NextResponse.json({
      success: true,
      userId,
      claimsSet: claims,
      message: 'Custom claims updated. User must re-login for changes to take effect.',
    });
  } catch (error: any) {
    console.error('[set-claims] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
