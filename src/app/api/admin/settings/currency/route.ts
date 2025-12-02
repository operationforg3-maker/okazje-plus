import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

/**
 * GET - Pobiera preferencję waluty dla importu produktów
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Dla GET bez auth zwracamy domyślną wartość
      return NextResponse.json({ currency: 'USD' });
    }

    const configDoc = await adminDb.collection('config').doc('currencyPreference').get();
    
    if (configDoc.exists) {
      const data = configDoc.data();
      return NextResponse.json({ 
        currency: data?.currency || 'USD',
        updatedAt: data?.updatedAt || null,
      });
    }

    return NextResponse.json({ currency: 'USD' });
  } catch (e: any) {
    console.error('[GET /api/admin/settings/currency] error', e);
    return NextResponse.json({ currency: 'USD' });
  }
}

/**
 * POST - Zapisuje preferencję waluty (wymaga autoryzacji admina)
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
    } catch (e) {
      console.error('[POST /api/admin/settings/currency] Token verify error', e);
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token użytkownika' }, { status: 401 });
    }

    // Sprawdź czy użytkownik jest adminem
    if (!decoded.admin) {
      return NextResponse.json({ success: false, message: 'Brak uprawnień administratora' }, { status: 403 });
    }

    const body = await req.json();
    const { currency } = body;

    if (!currency || !['USD', 'PLN', 'EUR'].includes(currency)) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowa waluta' }, { status: 400 });
    }

    // Zapisz do Firestore
    await adminDb.collection('config').doc('currencyPreference').set({
      currency,
      updatedAt: new Date().toISOString(),
      updatedBy: decoded.uid,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Preferencja waluty została zapisana',
      currency,
    });
  } catch (e: any) {
    console.error('[POST /api/admin/settings/currency] error', e);
    return NextResponse.json({ 
      success: false, 
      message: 'Błąd zapisu preferencji waluty' 
    }, { status: 500 });
  }
}
