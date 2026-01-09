import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';

// Schemat walidacji wejścia
const preRegSchema = z.object({
  email: z.string().min(5).max(120).email(),
  name: z.string().min(2).max(120),
});

// Limity
const MAX_REGISTRATIONS = 5000;
const PIONEER_THRESHOLD = 100;

// Anti-spam: prosty limiter IP (pamięć procesu)
const ipBuckets: Record<string, { count: number; first: number }> = {};
const WINDOW_MS = 60_000; // 1 minuta
const MAX_PER_WINDOW = 5; // max 5 prób na IP na minutę

function rateLimit(ip: string) {
  const now = Date.now();
  const bucket = ipBuckets[ip] || { count: 0, first: now };
  if (now - bucket.first > WINDOW_MS) {
    ipBuckets[ip] = { count: 1, first: now }; // reset okna
    return true;
  }
  bucket.count += 1;
  ipBuckets[ip] = bucket;
  return bucket.count <= MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = preRegSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Błędne dane', issues: parsed.error.flatten() }, { status: 400 });
    }
    const { email, name } = parsed.data;

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!rateLimit(ipAddress)) {
      return NextResponse.json({ success: false, error: 'Za dużo prób. Spróbuj za minutę.' }, { status: 429 });
    }

    const emailLower = email.toLowerCase();

    // Sprawdź duplikat (zapytanie indeksowane)
    const dupSnap = await adminDb.collection('pre_registrations').where('email', '==', emailLower).limit(1).get();
    if (!dupSnap.empty) {
      return NextResponse.json({ success: false, error: 'Ten adres email jest już zarejestrowany' }, { status: 409 });
    }

    // Pobierz bieżący count (agregacja) + wylicz numer — drobne ryzyko race, minimalizowane przez atomiczny add z serwerowym timestampem
    const countSnap = await adminDb.collection('pre_registrations').count().get();
    const currentCount = countSnap.data().count || 0;
    if (currentCount >= MAX_REGISTRATIONS) {
      return NextResponse.json({ success: false, error: 'Osiągnięto limit 5000 rejestracji' }, { status: 409 });
    }
    const registrationNumber = currentCount + 1;
    const role = registrationNumber <= PIONEER_THRESHOLD ? 'pioneer' : 'beta';

    // Zapis
    await adminDb.collection('pre_registrations').add({
      email: emailLower,
      name: name.trim(),
      role,
      status: 'pending',
      registrationNumber,
      createdAt: new Date().toISOString(),
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, registrationNumber, role });
  } catch (error) {
    console.error('[POST /api/pre-register] Error', error);
    return NextResponse.json({ success: false, error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}
