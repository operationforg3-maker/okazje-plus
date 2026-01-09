import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
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
    return NextResponse.json(
      { error: 'Nie udało się pobrać rejestracji' },
      { status: 500 }
    );
  }
}
