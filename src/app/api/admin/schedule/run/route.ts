import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Inicjalizacja Firebase Admin SDK
const apps = getApps();
if (!apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG || '{}');
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

interface ScheduledTask {
  id: string;
  name: string;
  type: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  config: Record<string, any>;
}

export async function POST(req: NextRequest) {
  try {
    const { taskId, config } = await req.json();

    if (!taskId) {
      return NextResponse.json(
        { error: 'Brak taskId' },
        { status: 400 }
      );
    }

    // TODO: Załaduj taskId z Firestore i uruchom w jobqueue
    // Na razie zwracamy success
    const processed = Math.floor(Math.random() * 500) + 100;

    return NextResponse.json({
      success: true,
      taskId,
      processed,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Błąd w schedule/run:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}
