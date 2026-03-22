import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth-server';

export async function GET() {
  try {
    await requireAdmin();
    // Pobierz wszystkie pre-rejestracje, sortuj po numerze
    const snapshot = await adminDb
      .collection('pre_registrations')
      .orderBy('registrationNumber', 'asc')
      .get();

    const registrations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ registrations });
  } catch (error) {
    console.error('[GET /api/admin/pre-registrations] Error', error);

    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Admin access required')) {
      return NextResponse.json(
        { error: 'Brak uprawnień administratora' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Nie udało się pobrać rejestracji' },
      { status: 500 }
    );
  }
}
