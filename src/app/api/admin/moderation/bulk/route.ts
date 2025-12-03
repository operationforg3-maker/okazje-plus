import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Bulk moderation endpoint
 * Body: { 
 *   items: Array<{ id: string; type: 'deal' | 'product' }>, 
 *   action: 'approve' | 'reject' | 'delete' | 'change-status',
 *   status?: string (dla action='change-status')
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Sprawdź autoryzację admina
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Brak nagłówka Authorization' }, { status: 401 });
    }

    const idToken = authHeader.substring('Bearer '.length).trim();
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
      console.log('[bulk moderation] User verified:', {
        uid: decoded.uid,
        email: decoded.email,
        admin: decoded.admin,
        role: decoded.role || 'not set'
      });
    } catch (e) {
      console.error('[bulk moderation] Token verify error', e);
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token użytkownika' }, { status: 401 });
    }

    // Sprawdź czy użytkownik jest adminem (admin custom claim LUB role z Firestore)
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = userDoc.data();
    const isAdmin = decoded.admin === true || userData?.role === 'admin';
    
    console.log('[bulk moderation] Admin check:', {
      uid: decoded.uid,
      customClaimAdmin: decoded.admin,
      firestoreRole: userData?.role,
      isAdmin
    });

    if (!isAdmin) {
      console.error('[bulk moderation] User is not admin:', decoded.uid);
      return NextResponse.json({ 
        success: false, 
        message: `Brak uprawnień administratora. Sprawdź ustawienia konta.` 
      }, { status: 403 });
    }

    const body = await req.json();
    const { items, action, status: targetStatus } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Brak elementów do przetworzenia' }, { status: 400 });
    }
    if (!['approve', 'reject', 'delete', 'change-status'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowa akcja' }, { status: 400 });
    }
    if (action === 'change-status' && !targetStatus) {
      return NextResponse.json({ success: false, message: 'Brak docelowego statusu' }, { status: 400 });
    }

    const ts = FieldValue.serverTimestamp();

    // Dla delete używamy osobnych operacji (batch.delete)
    if (action === 'delete') {
      const batch = adminDb.batch();
      for (const item of items) {
        if (!item?.id || !['deal', 'product'].includes(item.type)) continue;
        const col = item.type === 'deal' ? 'deals' : 'products';
        const docRef = adminDb.collection(col).doc(item.id);
        batch.delete(docRef);
      }
      await batch.commit();
      return NextResponse.json({ success: true, message: `Usunięto ${items.length} elementów` });
    }

    // Dla approve/reject/change-status używamy update
    const batch = adminDb.batch();
    let newStatus: string;

    if (action === 'change-status') {
      newStatus = targetStatus;
    } else {
      newStatus = action === 'approve' ? 'approved' : 'rejected';
    }

    for (const item of items) {
      if (!item?.id || !['deal', 'product'].includes(item.type)) continue;
      const col = item.type === 'deal' ? 'deals' : 'products';
      const docRef = adminDb.collection(col).doc(item.id);
      batch.update(docRef, { status: newStatus, updatedAt: ts });
    }

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: `Zmieniono status ${items.length} elementów na ${newStatus}` 
    });
  } catch (e: any) {
    console.error('[bulk moderation] error', e);
    return NextResponse.json({ success: false, message: 'Błąd przetwarzania' }, { status: 500 });
  }
}
