import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Prosty cache w pamięci na czas życia procesu (App Hosting: reset przy redeploy)
let cached = { count: 0, updatedAt: 0 };
const CACHE_MS = 30_000; // 30s

export async function GET() {
  try {
    const now = Date.now();
    if (now - cached.updatedAt < CACHE_MS) {
      return NextResponse.json({ count: cached.count, cached: true });
    }
    // Efektywne zliczanie dokumentów (Firestore aggregation count)
    const snap = await adminDb.collection('pre_registrations').count().get();
    const count = snap.data().count || 0;
    cached = { count, updatedAt: now };
    return NextResponse.json({ count, cached: false });
  } catch (error) {
    console.error('[GET /api/pre-register/count] Error', error);
    return NextResponse.json({ error: 'Nie udało się pobrać liczby rejestracji' }, { status: 500 });
  }
}
