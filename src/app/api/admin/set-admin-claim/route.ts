import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Endpoint do ustawiania custom claim 'admin' dla użytkownika
 * Wymaga super-admina (sprawdzany przez env variable lub hardcoded UID)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, setAdmin } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Sprawdź czy request pochodzi od super-admina
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.substring('Bearer '.length);
    const decoded = await getAuth().verifyIdToken(token);
    
    // Sprawdź czy caller jest już adminem w Firestore
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const callerData = callerDoc.data();
    
    if (callerData?.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Only admin can set custom claims',
        callerRole: callerData?.role 
      }, { status: 403 });
    }

    // Ustaw custom claim dla target usera
    await getAuth().setCustomUserClaims(userId, { admin: setAdmin === true });

    // Synchronizuj z Firestore
    await adminDb.collection('users').doc(userId).set({
      role: setAdmin ? 'admin' : 'user',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`[set-admin-claim] Set admin=${setAdmin} for user ${userId} by ${decoded.uid}`);

    return NextResponse.json({ 
      success: true, 
      message: `Custom claim 'admin' set to ${setAdmin} for user ${userId}`,
      note: 'User must refresh their token (re-login) for changes to take effect'
    });
  } catch (e: any) {
    console.error('[set-admin-claim] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * GET - sprawdź custom claims dla użytkownika
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId query param required' }, { status: 400 });
    }

    const user = await getAuth().getUser(userId);
    const firestoreDoc = await adminDb.collection('users').doc(userId).get();
    const firestoreData = firestoreDoc.data();

    return NextResponse.json({
      uid: user.uid,
      email: user.email,
      customClaims: user.customClaims || {},
      firestoreRole: firestoreData?.role || 'not set',
      hasAdminClaim: user.customClaims?.admin === true,
      hasAdminRole: firestoreData?.role === 'admin'
    });
  } catch (e: any) {
    console.error('[set-admin-claim] GET error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
