import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

// Lista użytkowników (wymaga roli admin) - używa Admin SDK dla pełnych uprawnień
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Brak nagłówka Authorization' }, { status: 401 });
    }

    const idToken = authHeader.substring('Bearer '.length).trim();
    const { getAuth } = await import('firebase-admin/auth');
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      console.error('[GET /api/admin/users] Token verify error', e);
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token' }, { status: 401 });
    }

    // Sprawdzenie roli admin w kolekcji users
    const adminDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Brak uprawnień' }, { status: 403 });
    }

    // Pobierz użytkowników posortowanych po createdAt desc (ISO string) - limit 200
    const snapshot = await adminDb
      .collection('users')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (error) {
    console.error('[GET /api/admin/users] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Nie udało się pobrać użytkowników' },
      { status: 500 }
    );
  }
}
