import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';

// Schemat walidacji - tylko email
const newsletterSchema = z.object({
  email: z.string().min(5).max(120).email(),
});

// Anti-spam limiter (prosta implementacja w pamięci)
const ipBuckets: Record<string, { count: number; first: number }> = {};
const WINDOW_MS = 60_000; // 1 minuta
const MAX_PER_WINDOW = 3; // max 3 próby na IP na minutę

function rateLimit(ip: string) {
  const now = Date.now();
  const bucket = ipBuckets[ip] || { count: 0, first: now };
  if (now - bucket.first > WINDOW_MS) {
    ipBuckets[ip] = { count: 1, first: now };
    return true;
  }
  bucket.count += 1;
  ipBuckets[ip] = bucket;
  return bucket.count <= MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = newsletterSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Nieprawidłowy format emaila' },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!rateLimit(ipAddress)) {
      return NextResponse.json(
        { success: false, error: 'Za dużo prób. Spróbuj za minutę.' },
        { status: 429 }
      );
    }

    const emailLower = email.toLowerCase();

    // Sprawdź, czy email już istnieje
    const existingSnap = await adminDb
      .collection('newsletter_subscriptions')
      .where('email', '==', emailLower)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      // Zwróć success, ale nie dodawaj duplikat (idempotent)
      return NextResponse.json({
        success: true,
        message: 'Email już jest subskrybowany',
        alreadySubscribed: true,
      });
    }

    // Dodaj email do kolekcji newsletter_subscriptions
    await adminDb.collection('newsletter_subscriptions').add({
      email: emailLower,
      status: 'active',
      subscribedAt: new Date().toISOString(),
      ipAddress,
      source: 'coming-soon-page',
    });

    return NextResponse.json({
      success: true,
      message: 'Dziękujemy za subskrypcję!',
    });
  } catch (error) {
    console.error('[POST /api/newsletter/subscribe] Error', error);
    return NextResponse.json(
      { success: false, error: 'Wystąpił błąd serwera' },
      { status: 500 }
    );
  }
}
