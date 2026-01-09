import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Endpoint do weryfikacji i wymuszenia odświeżenia custom claims
 * Zwraca aktualne claims z Firebase Auth
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const oldToken = authHeader.substring('Bearer '.length);
    const decoded = await getAuth().verifyIdToken(oldToken, true); // force refresh check

    // Pobierz aktualnego usera z Firebase Auth (ma najświeższe custom claims)
    const user = await getAuth().getUser(decoded.uid);
    
    // Pobierz też dane z Firestore dla porównania
    const firestoreDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const firestoreData = firestoreDoc.data();

    // Sprawdź czy custom claims są zsynchronizowane z Firestore
    const firestoreRole = firestoreData?.role;
    const authAdminClaim = user.customClaims?.admin === true;
    const shouldBeAdmin = firestoreRole === 'admin';
    
    if (authAdminClaim !== shouldBeAdmin) {
      console.log(`[refresh-claims] Syncing claims for ${decoded.uid}: Firestore=${firestoreRole}, Auth admin claim=${authAdminClaim}`);
      
      // Napraw custom claim
      await getAuth().setCustomUserClaims(decoded.uid, { admin: shouldBeAdmin });
      
      return NextResponse.json({
        success: true,
        message: 'Custom claims were out of sync and have been fixed. Please refresh your token.',
        wasSynced: true,
        oldAdminClaim: authAdminClaim,
        newAdminClaim: shouldBeAdmin,
        firestoreRole,
        note: 'Client should call Firebase auth.currentUser.getIdToken(true) to force refresh'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Custom claims are in sync',
      wasSynced: false,
      uid: user.uid,
      email: user.email,
      customClaims: user.customClaims || {},
      firestoreRole,
      isAdmin: authAdminClaim
    });
  } catch (e: any) {
    console.error('[refresh-claims] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
